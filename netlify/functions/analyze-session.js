// Netlify Function: Analyze Session - Review the complete session
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  try {
    // Parse the incoming request body
    const { ideology, style, allergies, selectedIdea, drafts, llmType } = JSON.parse(event.body);
    
    if (!ideology || !style || !allergies || !selectedIdea || !drafts || drafts.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required session data' })
      };
    }
    
    // Generate analysis of the session
    const analysis = await analyzeSessionData(ideology, style, allergies, selectedIdea, drafts, llmType);
    
    return {
      statusCode: 200,
      body: JSON.stringify({ analysis })
    };
    
  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

async function analyzeSessionData(ideology, style, allergies, selectedIdea, drafts, llmType) {
  // Select the appropriate API based on llmType
  let apiKey;
  let apiEndpoint;
  let requestBody;
  let headers = { 'Content-Type': 'application/json' };
  
  // Prepare drafts summary
  const draftsHistory = drafts.map((draft, index) => {
    return {
      draftNumber: index + 1,
      script: draft.finalDraft,
      feedback: draft.feedback || 'No feedback provided'
    };
  });
  
  const draftsHistoryText = JSON.stringify(draftsHistory, null, 2);
  const selectedIdeaText = JSON.stringify(selectedIdea, null, 2);
  
  const promptText = `You are an analytical AI assistant specializing in creative collaboration.
                      Review this complete session and provide insights on the persona configuration
                      and the creative process.
                      
                      PERSONA SETTINGS:
                      Ideology: ${ideology}
                      Style: ${style}
                      Allergies: ${allergies}
                      
                      SELECTED IDEA:
                      ${selectedIdeaText}
                      
                      DRAFTS HISTORY:
                      ${draftsHistoryText}
                      
                      Please analyze the session and provide:
                      
                      1. A comparison of the drafts, highlighting key changes and improvements
                      2. How the feedback was incorporated between versions
                      3. How the persona settings (ideology, style, allergies) influenced the creative process
                      4. Suggestions for improving the persona settings to achieve the final result more directly
                      5. Overall insights about the creative collaboration
                      
                      Format your analysis in clear sections with headings, using markdown formatting.`;
  
  switch (llmType) {
    case 'gemini':
      apiKey = process.env.GEMINI_API_KEY;
      apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
      requestBody = {
        contents: [{
          parts: [{ text: promptText }]
        }]
      };
      break;
      
    case 'gpt4':
      apiKey = process.env.OPENAI_API_KEY;
      apiEndpoint = 'https://api.openai.com/v1/chat/completions';
      headers['Authorization'] = `Bearer ${apiKey}`;
      requestBody = {
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are an analytical AI assistant specializing in creative collaboration."
          },
          {
            role: "user",
            content: promptText
          }
        ]
      };
      break;
      
    case 'claude':
      apiKey = process.env.ANTHROPIC_API_KEY;
      apiEndpoint = 'https://api.anthropic.com/v1/messages';
      headers['anthropic-version'] = '2023-06-01';
      headers['x-api-key'] = apiKey;
      requestBody = {
        model: "claude-3-opus-20240229",
        max_tokens: 2500,
        messages: [
          {
            role: "user",
            content: promptText
          }
        ]
      };
      break;
      
    default:
      throw new Error('Invalid LLM type specified');
  }
  
  // Make the API request
  const response = await fetch(apiEndpoint, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(requestBody)
  });
  
  const responseData = await response.json();
  
  // Process response based on LLM type
  let analysisText;
  try {
    if (llmType === 'gemini') {
      analysisText = responseData.candidates[0].content.parts[0].text;
    } else if (llmType === 'gpt4') {
      analysisText = responseData.choices[0].message.content;
    } else if (llmType === 'claude') {
      analysisText = responseData.content[0].text;
    }
    
    return analysisText;
  } catch (parseError) {
    console.error('Error parsing LLM response:', parseError);
    throw new Error('Could not parse analysis from LLM response');
  }
}
