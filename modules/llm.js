// LLM Module

// Generate ideas based on transcript and ideology
export async function generateIdeas(transcript, ideology, llmType) {
    try {
        const response = await fetch('/.netlify/functions/ideate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                transcript,
                ideology,
                llmType
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to generate ideas');
        }
        
        const data = await response.json();
        return data.ideas;
    } catch (error) {
        console.error('Error generating ideas:', error);
        throw error;
    }
}

// Create draft script
export async function createDraft(selectedIdea, qualitativeGuidance, ideology, style, allergies, llmType) {
    try {
        const response = await fetch('/.netlify/functions/create-draft', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                selectedIdea,
                qualitativeGuidance,
                ideology,
                style,
                allergies,
                llmType
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create draft');
        }
        
        const data = await response.json();
        return {
            preDraft: data.preDraft,
            finalDraft: data.finalDraft
        };
    } catch (error) {
        console.error('Error creating draft:', error);
        throw error;
    }
}

// Analyze session
export async function analyzeSession(ideology, style, allergies, selectedIdea, drafts, llmType) {
    try {
        const response = await fetch('/.netlify/functions/analyze-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ideology,
                style,
                allergies,
                selectedIdea,
                drafts,
                llmType
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to analyze session');
        }
        
        const data = await response.json();
        return data.analysis;
    } catch (error) {
        console.error('Error analyzing session:', error);
        throw error;
    }
}
