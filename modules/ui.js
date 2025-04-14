// UI Module

// Show a specific step and update progress indicator
export function showStep(stepNumber) {
    // Hide all step content
    const stepContents = document.querySelectorAll('.step-content');
    stepContents.forEach(content => {
        content.classList.remove('active');
    });
    
    // Combine steps 2-3 and 4-5
    let targetStepId;
    if (stepNumber === 2 || stepNumber === 3) {
        targetStepId = 'step-2-3';
        updateProgressIndicator(3); // Show as step 3 in progress indicator
    } else if (stepNumber === 4 || stepNumber === 5) {
        targetStepId = 'step-4-5';
        updateProgressIndicator(5); // Show as step 5 in progress indicator
    } else {
        targetStepId = `step-${stepNumber}`;
        updateProgressIndicator(stepNumber);
    }
    
    // Show the target step
    const targetStep = document.getElementById(targetStepId);
    if (targetStep) {
        targetStep.classList.add('active');
    }
}

// Update the progress indicator
export function updateProgressIndicator(currentStep) {
    const steps = document.querySelectorAll('.progress-indicator .step');
    
    steps.forEach((step, index) => {
        const stepNumber = index + 1;
        
        // Remove all classes first
        step.classList.remove('active', 'completed');
        
        if (stepNumber < currentStep) {
            step.classList.add('completed');
        } else if (stepNumber === currentStep) {
            step.classList.add('active');
        }
    });
}

// Toggle collapsible elements
export function toggleCollapsible(element) {
    element.classList.toggle('active');
    const content = element.nextElementSibling;
    
    if (content.style.maxHeight) {
        content.style.maxHeight = null;
        content.style.padding = '0 18px';
    } else {
        content.style.maxHeight = content.scrollHeight + 'px';
        content.style.padding = '18px';
    }
}

// Show loading spinner
export function showLoading(message = 'Loading...') {
    // Find the active step
    const activeStep = document.querySelector('.step-content.active');
    
    if (activeStep) {
        // Find all loading containers in the active step
        const loadingContainers = activeStep.querySelectorAll('.loading-container');
        
        if (loadingContainers.length > 0) {
            loadingContainers.forEach(container => {
                // Update loading message if provided
                const messageElement = container.querySelector('p');
                if (messageElement) {
                    messageElement.textContent = message;
                }
                
                // Show the loading container
                container.style.display = 'flex';
            });
        }
    }
}

// Hide loading spinner
export function hideLoading() {
    // Find all loading containers
    const loadingContainers = document.querySelectorAll('.loading-container');
    
    // Hide all loading containers
    loadingContainers.forEach(container => {
        container.style.display = 'none';
    });
}

