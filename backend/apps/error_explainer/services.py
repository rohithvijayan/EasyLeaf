import os
import logging
from groq import Groq

logger = logging.getLogger(__name__)

class GroqService:
    def __init__(self):
        self.api_key = os.getenv("GROQ_API_KEY")
        if not self.api_key:
            logger.warning("GROQ_API_KEY is not set. AI features will not return real data.")
            self.client = None
        else:
            self.client = Groq(api_key=self.api_key)

    def explain_error(self, error_message, invalid_line, context_chunks):
        """
        Generates a structured explanation and fix for a LaTeX error.
        
        Args:
            error_message (str): The error message from the log.
            invalid_line (str): The code content of the failing line.
            context_chunks (dict): { 'preamble': str, 'contextLines': str }
            
        Returns:
            dict: { 'explanation': str, 'fix': str, 'fixed_code': str }
        """
        if not self.client:
            return {
                "explanation": "AI service is not configured (missing API key).",
                "fix": "Please check your backend configuration.",
                "fixed_code": invalid_line
            }

        prompt = self._build_prompt(error_message, invalid_line, context_chunks)
        
        try:
            completion = self.client.chat.completions.create(
                model="llama3-70b-8192",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a LaTeX expert debugger. "
                            "Your goal is to fix compilation errors for beginners. "
                            "Return ONLY valid JSON with keys: 'explanation' (1 sentence, simple English), "
                            "'fix' (short action), and 'fixed_code' (the corrected line ONLY). "
                            "Do not include markdown formatting or backticks around the JSON."
                        )
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.1,
                max_tokens=300,
                response_format={"type": "json_object"}
            )
            
            # Parse response
            import json
            content = completion.choices[0].message.content
            return json.loads(content)
            
        except Exception as e:
            logger.error(f"Groq API Error: {str(e)}")
            return {
                "explanation": "I encountered an error while analyzing this code.",
                "fix": "Try checking for typos manually.",
                "fixed_code": invalid_line
            }

    def _build_prompt(self, error, line, context):
        return f"""
LaTeX Error: {error}
Broken Line: {line}

Context (Surrounding Lines):
{context.get('contextLines', '')}

Preamble (Definitions):
{context.get('preamble', '')}

Task:
1. Identify the syntax error.
2. Explain it simply like I'm 5 years old.
3. Provide the corrected version of the Broken Line.
"""
