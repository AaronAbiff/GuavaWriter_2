// YouTube Module

// Extract transcript from YouTube video
export async function extractTranscript(youtubeUrl) {
    try {
        // Extract video ID from URL
        const videoId = extractVideoId(youtubeUrl);
        if (!videoId) {
            throw new Error('Invalid YouTube URL');
        }
        
        // Call the serverless function to extract transcript
        const response = await fetch('/.netlify/functions/youtube-transcript', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ videoId })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to extract transcript');
        }
        
        const data = await response.json();
        return data.transcript;
    } catch (error) {
        console.error('Error extracting transcript:', error);
        throw error;
    }
}

// Helper function to extract video ID from various YouTube URL formats
function extractVideoId(url) {
    // Regular expressions for different YouTube URL formats
    const regexPatterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\?\/]+)/,
        /youtube\.com\/embed\/([^\/\?]+)/,
        /youtube\.com\/v\/([^\/\?]+)/
    ];
    
    for (const pattern of regexPatterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    
    return null;
}
