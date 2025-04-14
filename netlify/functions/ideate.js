// Netlify Function: Ideate - Generate ideas based on transcript
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  try {
    // Parse the incoming request body
    const { transcript, ideology, llmType } = JSON.parse(event.body);
    
    if (!transcript || !ideology) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Transcript and ideology are required' })
      };
    }
    
    // Select the appropriate API based on llmType
    let apiKey;
    let apiEndpoint;
    let requestBody;
    let headers = { 'Content-Type': 'application/json' };
    
    switch (llmType) {
      case 'gemini':
        apiKey = process.env.GEMINI_API_KEY;
        apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
        requestBody = {
          contents: [{
            parts: [{
              text: `You are a creative content ideator specializing in 30-second video essays for Instagram.
                     Based on the following transcript and persona ideology, generate 3 distinct ideas.
                     Each idea should have a Hook (engaging thought/question), a Basis (factual information),
                     and an Angle (perspective that makes it meaningful).
                     
                     TRANSCRIPT:
                     ${transcript.substring(0, 2000)}...
                     
                     IDEOLOGY:
                     ${ideology}
                     
                     FORMAT YOUR RESPONSE AS JSON IN THE FOLLOWING FORMAT:
                     [
                       {
                         "hook": "The hook for idea 1",
                         "basis": "The factual basis for idea 1",
                         "angle": "The perspective angle for idea 1"
                       },
                       {
                         "hook": "The hook for idea 2",
                         "basis": "The factual basis for idea 2",
                         "angle": "The perspective angle for idea 2"
                       },
                       {
                         "hook": "The hook for idea 3",
                         "basis": "The factual basis for idea 3",
                         "angle": "The perspective angle for idea 3"
                       }
                     ]`
              }]
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
              content: "You are a creative content ideator specializing in 30-second video essays for Instagram."
            },
            {
              role: "user",
              content: `Based on the following transcript and persona ideology, generate 3 distinct ideas.
                        Each idea should have a Hook (engaging thought/question), a Basis (factual information),
                        and an Angle (perspective that makes it meaningful).
                        
                        TRANSCRIPT:
                        ${transcript.substring(0, 4000)}...
                        
                        IDEOLOGY:
                        ${ideology}
                        
                        FORMAT YOUR RESPONSE AS JSON IN THE FOLLOWING FORMAT:
                        [
                          {
                            "hook": "The hook for idea 1",
                            "basis": "The factual basis for idea 1",
                            "angle": "The perspective angle for idea 1"
                          },
                          {
                            "hook": "The hook for idea 2",
                            "basis": "The factual basis for idea 2",
                            "angle": "The perspective angle for idea 2"
                          },
                          {
                            "hook": "The hook for idea 3",
                            "basis": "The factual basis for idea 3",
                            "angle": "The perspective angle for idea 3"
                          }
                        ]`
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
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: `Based on the following transcript and persona ideology, generate 3 distinct ideas.
                        Each idea should have a Hook (engaging thought/question), a Basis (factual information),
                        and an Angle (perspective that makes it meaningful).
                        
                        TRANSCRIPT:
                        ${transcript.substring(0, 4000)}...
                        
                        IDEOLOGY:
                        ${ideology}
                        
                        FORMAT YOUR RESPONSE AS JSON IN THE FOLLOWING FORMAT:
                        [
                          {
                            "hook": "The hook for idea 1",
                            "basis": "The factual basis for idea 1",
                            "angle": "The perspective angle for idea 1"
                          },
                          {
                            "hook": "The hook for idea 2",
                            "basis": "The factual basis for idea 2",
                            "angle": "The perspective angle for idea 2"
                          },
                          {
                            "hook": "The hook for idea 3",
                            "basis": "The factual basis for idea 3",
                            "angle": "The perspective angle for idea 3"
                          }
                        ]`
            }
          ]
        };
        break;
        
      default:
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Invalid LLM type specified' })
        };
    }
    
    // Make the API request
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    });
    
    const responseData = await response.json();
    
    // Process response based on LLM type
    let ideas;
    try {
      if (llmType === 'gemini') {
        const textResponse = responseData.candidates[0].content.parts[0].text;
        ideas = extractJsonFromText(textResponse);
      } else if (llmType === 'gpt4') {
        const textResponse = responseData.choices[0].message.content;
        ideas = extractJsonFromText(textResponse);
      } else if (llmType === 'claude') {
        const textResponse = responseData.content[0].text;
        ideas = extractJsonFromText(textResponse);
      }
      
      // Validate ideas format
      if (!Array.isArray(ideas) || ideas.length < 3) {
        throw new Error('Invalid ideas format returned from LLM');
      }
      
      return {
        statusCode: 200,
        body: JSON.stringify({ ideas })
      };
    } catch (parseError) {
      console.error('Error parsing LLM response:', parseError);
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: 'Error parsing LLM response',
          rawResponse: responseData
        })
      };
    }
    
  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

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
