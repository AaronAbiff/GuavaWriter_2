// Netlify Function: Create Draft - Generate script drafts
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  try {
    // Parse the incoming request body
    const { selectedIdea, qualitativeGuidance, ideology, style, allergies, llmType } = JSON.parse(event.body);
    
    if (!selectedIdea || !ideology || !style) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Selected idea, ideology, and style are required' })
      };
    }
    
    // First, generate the pre-draft using ideology and style
    const preDraft = await generatePreDraft(selectedIdea, qualitativeGuidance, ideology, style, llmType);
    
    // Then, edit the pre-draft based on allergies
    const finalDraft = await editDraft(preDraft, allergies, ideology, style, llmType);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        preDraft,
        finalDraft
      })
    };
    
  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

async function generatePreDraft(selectedIdea, qualitativeGuidance, ideology, style, llmType) {
  // Select the appropriate API based on llmType
  let apiKey;
  let apiEndpoint;
  let requestBody;
  let headers = { 'Content-Type': 'application/json' };
  
  const promptText = `You are a creative scriptwriter for 30-second Instagram video essays.
                      Create a script based on the following idea and guidance.
                      
                      SELECTED IDEA:
                      Hook: ${selectedIdea.hook}
                      Basis: ${selectedIdea.basis}
                      Angle: ${selectedIdea.angle}
                      
                      QUALITATIVE GUIDANCE:
                      ${qualitativeGuidance || 'No additional guidance provided.'}
                      
                      IDEOLOGY (Narrative context and relationship to viewer):
                      ${ideology}
                      
                      STYLE (Aesthetic characteristics of language and output):
                      ${style}
                      
                      FORMAT YOUR RESPONSE AS JSON IN THE FOLLOWING FORMAT:
                      [
                        {
                          "voScript": "Line 1 of voice over script",
                          "visuals": "Description of visuals for line 1"
                        },
                        {
                          "voScript": "Line 2 of voice over script",
                          "visuals": "Description of visuals for line 2"
                        },
                        ...
                      ]
                      
                      The script should be 6-10 lines long, optimized for a 30-second video.`;
  
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
            content: "You are a creative scriptwriter for short-form video content."
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
        max_tokens: 1500,
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
  let draft;
  try {
    if (llmType === 'gemini') {
      const textResponse = responseData.candidates[0].content.parts[0].text;
      draft = extractJsonFromText(textResponse);
    } else if (llmType === 'gpt4') {
      const textResponse = responseData.choices[0].message.content;
      draft = extractJsonFromText(textResponse);
    } else if (llmType === 'claude') {
      const textResponse = responseData.content[0].text;
      draft = extractJsonFromText(textResponse);
    }
    
    // Validate draft format
    if (!Array.isArray(draft) || draft.length < 1) {
      throw new Error('Invalid draft format returned from LLM');
    }
    
    return draft;
  } catch (parseError) {
    console.error('Error parsing LLM response:', parseError);
    throw new Error('Could not parse draft from LLM response');
  }
}

async function editDraft(preDraft, allergies, ideology, style, llmType) {
  // Select the appropriate API based on llmType
  let apiKey;
  let apiEndpoint;
  let requestBody;
  let headers = { 'Content-Type': 'application/json' };
  
  const preDraftText = JSON.stringify(preDraft, null, 2);
  
  const promptText = `You are an editor for video scripts. Review and edit the following script
                      according to the creator's aesthetic allergies (preferences to avoid).
                      
                      PRE-DRAFT SCRIPT:
                      ${preDraftText}
                      
                      ALLERGIES (Aesthetic preferences to avoid):
                      ${allergies}
                      
                      BRIEF CONTEXT:
                      Ideology: ${ideology.substring(0, 150)}...
                      Style: ${style.substring(0, 150)}...
                      
                      Edit the script to avoid the aesthetic allergies while maintaining the
                      core message and style. Be particular about language choices.
                      
                      FORMAT YOUR RESPONSE AS JSON IN THE FOLLOWING FORMAT:
                      [
                        {
                          "voScript": "Edited line 1 of voice over script",
                          "visuals": "Edited description of visuals for line 1"
                        },
                        {
                          "voScript": "Edited line 2 of voice over script",
                          "visuals": "Edited description of visuals for line 2"
                        },
                        ...
                      ]
                      
                      The edited script should still be 6-10 lines long, optimized for a 30-second video.`;
  
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
            content: "You are a skilled editor for creative content."
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
        max_tokens: 1500,
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
  let editedDraft;
  try {
    if (llmType === 'gemini') {
      const textResponse = responseData.candidates[0].content.parts[0].text;
      editedDraft = extractJsonFromText(textResponse);
    } else if (llmType === 'gpt4') {
      const textResponse = responseData.choices[0].message.content;
      editedDraft = extractJsonFromText(textResponse);
    } else if (llmType === 'claude') {
      const textResponse = responseData.content[0].text;
      editedDraft = extractJsonFromText(textResponse);
    }
    
    // Validate draft format
    if (!Array.isArray(editedDraft) || editedDraft.length < 1) {
      throw new Error('Invalid edited draft format returned from LLM');
    }
    
    return editedDraft;
  } catch (parseError) {
    console.error('Error parsing LLM response:', parseError);
    throw new Error('Could not parse edited draft from LLM response');
  }
}

// Helper function to extract JSON from text response
function extractJsonFromText(text) {
  try {
    // Find JSON array in text
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // If no JSON array found, try to parse the entire text
    return JSON.parse(text);
  } catch (error) {
    console.error('Error extracting JSON:', error);
    throw new Error('Could not extract valid JSON from LLM response');
  }
}
