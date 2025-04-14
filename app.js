// Import modules
import { initStorage, saveSession, loadSession, exportSession, importSession } from './modules/storage.js';
import { extractTranscript } from './modules/youtube.js';
import { generateIdeas, createDraft, analyzeSession } from './modules/llm.js';
import { showStep, updateProgressIndicator, toggleCollapsible, showLoading, hideLoading } from './modules/ui.js';

// Initialize the application
document.addEventListener('DOMContentLoaded', init);

async function init() {
    // Initialize storage
    await initStorage();
    
    // Set up event listeners
    setupEventListeners();
    
    // Check for existing session
    const currentSession = await loadSession();
    if (currentSession) {
        // Restore session state
        restoreSession(currentSession);
    }
}

function setupEventListeners() {
    // Step 1: INPUT
    document.getElementById('extract-transcript').addEventListener('click', handleExtractTranscript);
    document.getElementById('save-input').addEventListener('click', handleSaveInput);
    
    // Step 2-3: IDEATE & SELECT
    document.getElementById('back-to-input').addEventListener('click', () => showStep(1));
    document.getElementById('save-selection').addEventListener('click', handleSaveSelection);
    document.getElementById('idea-selection').addEventListener('change', handleIdeaSelectionChange);
    
    // Step 4-5: CREATE & REVIEW
    document.getElementById('back-to-ideate').addEventListener('click', () => showStep(2));
    document.getElementById('submit-feedback').addEventListener('click', handleSubmitFeedback);
    document.getElementById('toggle-pre-draft').addEventListener('click', togglePreDraft);
    document.getElementById('toggle-final-draft').addEventListener('click', toggleFinalDraft);
    document.getElementById('draft-history-select').addEventListener('change', handleDraftHistoryChange);
    
    // Step 6: ANALYSE
    document.getElementById('back-to-review').addEventListener('click', () => showStep(4));
    document.getElementById('proceed-to-confirm').addEventListener('click', () => showStep(7));
    
    // Step 7: CONFIRM
    document.getElementById('back-to-analysis').addEventListener('click', () => showStep(6));
    document.getElementById('save-session').addEventListener('click', handleSaveCompleteSession);
    document.getElementById('export-session').addEventListener('click', handleExportSession);
    document.getElementById('start-new-session').addEventListener('click', handleStartNewSession);
    
    // THREAD viewer
    document.getElementById('view-thread').addEventListener('click', handleViewThread);
    
    // Set up collapsible elements
    const collapsibles = document.getElementsByClassName('collapsible');
    for (let i = 0; i < collapsibles.length; i++) {
        collapsibles[i].addEventListener('click', function() {
            toggleCollapsible(this);
        });
    }
    
    // Modal close buttons
    const closeButtons = document.getElementsByClassName('close-modal');
    for (let i = 0; i < closeButtons.length; i++) {
        closeButtons[i].addEventListener('click', function() {
            this.parentElement.parentElement.style.display = 'none';
        });
    }
    
    // Import/Export
    document.getElementById('import-session-data').addEventListener('click', handleImportSession);
    document.getElementById('copy-session-data').addEventListener('click', handleCopySessionData);
}

// Handler functions for various user interactions

async function handleExtractTranscript() {
    const youtubeUrl = document.getElementById('youtube-url').value;
    if (!youtubeUrl) {
        alert('Please enter a YouTube URL');
        return;
    }
    
    try {
        showLoading('Extracting transcript...');
        const transcript = await extractTranscript(youtubeUrl);
        document.getElementById('transcript-content').textContent = transcript;
        document.querySelector('.collapsible').classList.add('active');
        document.querySelector('.collapsible-content').style.maxHeight = document.querySelector('.collapsible-content').scrollHeight + 'px';
        hideLoading();
    } catch (error) {
        hideLoading();
        alert('Error extracting transcript: ' + error.message);
    }
}

async function handleSaveInput() {
    const youtubeUrl = document.getElementById('youtube-url').value;
    const transcript = document.getElementById('transcript-content').textContent;
    const ideology = document.getElementById('ideology').value;
    const style = document.getElementById('style').value;
    const allergies = document.getElementById('allergies').value;
    const llmType = document.getElementById('llm-selection').value;
    
    if (!youtubeUrl || transcript === 'Transcript will appear here...' || !ideology || !style || !allergies) {
        alert('Please fill in all required fields and extract a transcript');
        return;
    }
    
    // Save to session
    await saveSession({
        step: 1,
        youtubeUrl,
        transcript,
        ideology,
        style,
        allergies,
        llmType
    });
    
    // Proceed to IDEATE
    showStep(2);
    generateIdeasFromTranscript();
}

async function generateIdeasFromTranscript() {
    try {
        const currentSession = await loadSession();
        showLoading('Generating ideas...');
        
        const ideas = await generateIdeas(
            currentSession.transcript,
            currentSession.ideology,
            currentSession.llmType
        );
        
        // Display ideas
        const ideasTable = document.getElementById('ideas-tbody');
        ideasTable.innerHTML = '';
        
        ideas.forEach((idea, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${idea.hook}</td>
                <td>${idea.basis}</td>
                <td>${idea.angle}</td>
                <td><input type="radio" name="idea-radio" value="${index + 1}"></td>
            `;
            ideasTable.appendChild(row);
        });
        
        // Save ideas to session
        await saveSession({
            ...currentSession,
            ideas
        });
        
        // Show ideas container
        document.getElementById('ideas-container').style.display = 'block';
        hideLoading();
        
        // Set up radio button listeners
        const radioButtons = document.getElementsByName('idea-radio');
        for (let i = 0; i < radioButtons.length; i++) {
            radioButtons[i].addEventListener('change', function() {
                document.getElementById('idea-selection').value = this.value;
                handleIdeaSelectionChange();
            });
        }
        
    } catch (error) {
        hideLoading();
        alert('Error generating ideas: ' + error.message);
    }
}

function handleIdeaSelectionChange() {
    const selection = document.getElementById('idea-selection').value;
    const customContainer = document.getElementById('custom-idea-container');
    
    if (selection === 'custom') {
        customContainer.style.display = 'block';
    } else {
        customContainer.style.display = 'none';
        
        // If a numbered idea is selected, check the corresponding radio
        if (selection && selection !== 'custom') {
            const radioButtons = document.getElementsByName('idea-radio');
            radioButtons[parseInt(selection) - 1].checked = true;
        }
    }
}

async function handleSaveSelection() {
    const selection = document.getElementById('idea-selection').value;
    if (!selection) {
        alert('Please select an idea or choose "Custom"');
        return;
    }
    
    const qualitativeGuidance = document.getElementById('qualitative-guidance').value;
    const currentSession = await loadSession();
    
    let selectedIdea;
    if (selection === 'custom') {
        selectedIdea = {
            hook: document.getElementById('custom-hook').value,
            basis: document.getElementById('custom-basis').value,
            angle: document.getElementById('custom-angle').value
        };
        
        if (!selectedIdea.hook || !selectedIdea.basis || !selectedIdea.angle) {
            alert('Please fill in all custom idea fields');
            return;
        }
    } else {
        selectedIdea = currentSession.ideas[parseInt(selection) - 1];
    }
    
    // Save selection to session
    await saveSession({
        ...currentSession,
        step: 3,
        selectedIdea,
        qualitativeGuidance
    });
    
    // Proceed to CREATE
    showStep(4);
    generateDraftScript();
}

async function generateDraftScript() {
    try {
        const currentSession = await loadSession();
        showLoading('Generating draft script...');
        
        const { preDraft, finalDraft } = await createDraft(
            currentSession.selectedIdea,
            currentSession.qualitativeGuidance,
            currentSession.ideology,
            currentSession.style,
            currentSession.allergies,
            currentSession.llmType
        );
        
        // Display drafts
        displayDraft(preDraft, 'pre-draft-tbody');
        displayDraft(finalDraft, 'final-draft-tbody');
        
        // Update session with drafts
        const drafts = currentSession.drafts || [];
        drafts.push({
            preDraft,
            finalDraft,
            feedback: '',
            status: 'needs-revision',
            timestamp: new Date().toISOString()
        });
        
        await saveSession({
            ...currentSession,
            step: 4,
            drafts,
            currentDraftIndex: drafts.length - 1
        });
        
        // Update draft history dropdown
        updateDraftHistoryDropdown(drafts.length);
        
        // Show draft container
        document.getElementById('draft-container').style.display = 'block';
        hideLoading();
        
    } catch (error) {
        hideLoading();
        alert('Error generating draft: ' + error.message);
    }
}

function displayDraft(draft, targetElementId) {
    const tbody = document.getElementById(targetElementId);
    tbody.innerHTML = '';
    
    draft.forEach((line, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${line.voScript}</td>
            <td>${line.visuals}</td>
        `;
        tbody.appendChild(row);
    });
}

function togglePreDraft() {
    const preDraftButton = document.getElementById('toggle-pre-draft');
    const finalDraftButton = document.getElementById('toggle-final-draft');
    const preDraftContent = document.getElementById('pre-draft-content');
    const finalDraftContent = document.getElementById('final-draft-content');
    
    preDraftButton.classList.add('active');
    finalDraftButton.classList.remove('active');
    preDraftContent.style.display = 'block';
    finalDraftContent.style.display = 'none';
}

function toggleFinalDraft() {
    const preDraftButton = document.getElementById('toggle-pre-draft');
    const finalDraftButton = document.getElementById('toggle-final-draft');
    const preDraftContent = document.getElementById('pre-draft-content');
    const finalDraftContent = document.getElementById('final-draft-content');
    
    preDraftButton.classList.remove('active');
    finalDraftButton.classList.add('active');
    preDraftContent.style.display = 'none';
    finalDraftContent.style.display = 'block';
}

function updateDraftHistoryDropdown(draftCount) {
    const select = document.getElementById('draft-history-select');
    select.innerHTML = '';
    
    for (let i = 0; i < draftCount; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Draft ${i + 1}`;
        select.appendChild(option);
    }
    
    // Select the latest draft
    select.value = draftCount - 1;
}

async function handleDraftHistoryChange() {
    const selectedIndex = parseInt(document.getElementById('draft-history-select').value);
    const currentSession = await loadSession();
    
    if (currentSession.drafts && currentSession.drafts[selectedIndex]) {
        const draft = currentSession.drafts[selectedIndex];
        
        // Display the selected draft
        displayDraft(draft.preDraft, 'pre-draft-tbody');
        displayDraft(draft.finalDraft, 'final-draft-tbody');
        
        // Update the feedback field if there's feedback
        document.getElementById('draft-feedback').value = draft.feedback || '';
        
        // Update the draft status radio buttons
        if (draft.status === 'approved') {
            document.getElementById('approved').checked = true;
        } else {
            document.getElementById('needs-revision').checked = true;
        }
        
        // Update the current draft index in session
        await saveSession({
            ...currentSession,
            currentDraftIndex: selectedIndex
        });
    }
}

async function handleSubmitFeedback() {
    const feedback = document.getElementById('draft-feedback').value;
    const status = document.querySelector('input[name="draft-status"]:checked').value;
    
    if (!feedback) {
        alert('Please provide feedback on the draft');
        return;
    }
    
    const currentSession = await loadSession();
    const currentDraftIndex = currentSession.currentDraftIndex;
    
    // Update the current draft with feedback
    currentSession.drafts[currentDraftIndex].feedback = feedback;
    currentSession.drafts[currentDraftIndex].status = status;
    
    await saveSession({
        ...currentSession,
        step: 5
    });
    
    if (status === 'approved') {
        // If approved, proceed to ANALYSE
        showStep(6);
        analyzeSessionData();
    } else {
        // If needs revision, generate a new draft
        generateDraftScript();
    }
}

async function analyzeSessionData() {
    try {
        const currentSession = await loadSession();
        showLoading('Analyzing session...');
        
        const analysis = await analyzeSession(
            currentSession.ideology,
            currentSession.style,
            currentSession.allergies,
            currentSession.selectedIdea,
            currentSession.drafts,
            currentSession.llmType
        );
        
        // Display analysis
        document.getElementById('analysis-content').innerHTML = analysis;
        
        // Save analysis to session
        await saveSession({
            ...currentSession,
            step: 6,
            analysis
        });
        
        // Show analysis container
        document.getElementById('analysis-container').style.display = 'block';
        hideLoading();
        
    } catch (error) {
        hideLoading();
        alert('Error analyzing session: ' + error.message);
    }
}

async function handleSaveCompleteSession() {
    const additionalNotes = document.getElementById('additional-notes').value;
    const editedAnalysis = document.getElementById('edited-analysis').value;
    const currentSession = await loadSession();
    
    // Get the final approved draft
    let finalScript = null;
    for (let i = currentSession.drafts.length - 1; i >= 0; i--) {
        if (currentSession.drafts[i].status === 'approved') {
            finalScript = currentSession.drafts[i].finalDraft;
            break;
        }
    }
    
    if (!finalScript) {
        alert('No approved draft found. Please go back and approve a draft.');
        return;
    }
    
    // Update session with final data
    await saveSession({
        ...currentSession,
        step: 7,
        editedAnalysis: editedAnalysis || currentSession.analysis,
        additionalNotes,
        finalScript,
        completed: true,
        completedAt: new Date().toISOString()
    });
    
    // Show completion message
    document.getElementById('confirm-container').style.display = 'none';
    document.getElementById('session-saved-message').style.display = 'block';
}

async function handleExportSession() {
    const sessionData = await exportSession();
    document.getElementById('session-data').value = JSON.stringify(sessionData, null, 2);
    document.getElementById('import-export-modal').style.display = 'block';
}

function handleCopySessionData() {
    const sessionData = document.getElementById('session-data');
    sessionData.select();
    document.execCommand('copy');
    alert('Session data copied to clipboard!');
}

async function handleImportSession() {
    try {
        const sessionDataString = document.getElementById('session-data').value;
        if (!sessionDataString) {
            alert('Please paste session data');
            return;
        }
        
        const sessionData = JSON.parse(sessionDataString);
        await importSession(sessionData);
        
        // Close modal and reload page
        document.getElementById('import-export-modal').style.display = 'none';
        window.location.reload();
    } catch (error) {
        alert('Error importing session: ' + error.message);
    }
}

async function handleStartNewSession() {
    // Clear current session and reload page
    await saveSession(null);
    window.location.reload();
}

async function handleViewThread() {
    const currentSession = await loadSession();
    document.getElementById('thread-content').textContent = JSON.stringify(currentSession, null, 2);
    document.getElementById('thread-modal').style.display = 'block';
}

async function restoreSession(session) {
    // Restore values in the form fields
    if (session.youtubeUrl) {
        document.getElementById('youtube-url').value = session.youtubeUrl;
    }
    
    if (session.transcript) {
        document.getElementById('transcript-content').textContent = session.transcript;
    }
    
    if (session.ideology) {
        document.getElementById('ideology').value = session.ideology;
    }
    
    if (session.style) {
        document.getElementById('style').value = session.style;
    }
    
    if (session.allergies) {
        document.getElementById('allergies').value = session.allergies;
    }
    
    if (session.llmType) {
        document.getElementById('llm-selection').value = session.llmType;
    }
    
    // If analysis exists, populate it
    if (session.analysis) {
        document.getElementById('analysis-content').innerHTML = session.analysis;
        document.getElementById('edited-analysis').value = session.editedAnalysis || session.analysis;
    }
    
    // If additional notes exist
    if (session.additionalNotes) {
        document.getElementById('additional-notes').value = session.additionalNotes;
    }
    
    // If there's a final script, display it
    if (session.finalScript) {
        const finalScriptHtml = session.finalScript.map((line, index) => {
            return `<p><strong>${index + 1}:</strong> ${line.voScript} <em>(${line.visuals})</em></p>`;
        }).join('');
        
        document.getElementById('final-script-content').innerHTML = finalScriptHtml;
    }
    
    // Navigate to the correct step
    if (session.step) {
        showStep(session.step);
        
        // Additional step-specific restorations
        if (session.step >= 2 && session.ideas) {
            // Restore ideas table
            const ideasTable = document.getElementById('ideas-tbody');
            ideasTable.innerHTML = '';
            
            session.ideas.forEach((idea, index) => {
                const row = document.createElement('tr');
                const isSelected = session.selectedIdea && 
                                  idea.hook === session.selectedIdea.hook && 
                                  idea.basis === session.selectedIdea.basis;
                
                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${idea.hook}</td>
                    <td>${idea.basis}</td>
                    <td>${idea.angle}</td>
                    <td><input type="radio" name="idea-radio" value="${index + 1}" ${isSelected ? 'checked' : ''}></td>
                `;
                ideasTable.appendChild(row);
            });
            
            document.getElementById('ideas-container').style.display = 'block';
        }
        
        if (session.step >= 3 && session.qualitativeGuidance) {
            document.getElementById('qualitative-guidance').value = session.qualitativeGuidance;
            
            if (session.selectedIdea) {
                // Determine if it's a custom idea or one of the generated ones
                let isCustom = true;
                if (session.ideas) {
                    for (let i = 0; i < session.ideas.length; i++) {
                        const idea = session.ideas[i];
                        if (idea.hook === session.selectedIdea.hook && 
                            idea.basis === session.selectedIdea.basis &&
                            idea.angle === session.selectedIdea.angle) {
                            document.getElementById('idea-selection').value = (i + 1).toString();
                            isCustom = false;
                            break;
                        }
                    }
                }
                
                if (isCustom) {
                    document.getElementById('idea-selection').value = 'custom';
                    document.getElementById('custom-idea-container').style.display = 'block';
                    document.getElementById('custom-hook').value = session.selectedIdea.hook;
                    document.getElementById('custom-basis').value = session.selectedIdea.basis;
                    document.getElementById('custom-angle').value = session.selectedIdea.angle;
                }
            }
        }
        
        if (session.step >= 4 && session.drafts && session.drafts.length > 0) {
            // Restore drafts
            const currentDraftIndex = session.currentDraftIndex || session.drafts.length - 1;
            const currentDraft = session.drafts[currentDraftIndex];
            
            displayDraft(currentDraft.preDraft, 'pre-draft-tbody');
            displayDraft(currentDraft.finalDraft, 'final-draft-tbody');
            
            // Update draft history dropdown
            updateDraftHistoryDropdown(session.drafts.length);
            document.getElementById('draft-history-select').value = currentDraftIndex;
            
            // Restore feedback if available
            if (currentDraft.feedback) {
                document.getElementById('draft-feedback').value = currentDraft.feedback;
            }
            
            // Restore draft status
            if (currentDraft.status === 'approved') {
                document.getElementById('approved').checked = true;
            } else {
                document.getElementById('needs-revision').checked = true;
            }
            
            document.getElementById('draft-container').style.display = 'block';
        }
        
        if (session.step >= 6 && session.analysis) {
            document.getElementById('analysis-container').style.display = 'block';
        }
        
        if (session.completed) {
            document.getElementById('confirm-container').style.display = 'none';
            document.getElementById('session-saved-message').style.display = 'block';
        }
    }
}
