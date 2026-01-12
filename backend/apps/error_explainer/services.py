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
                        "content": self._get_system_prompt()
                    },
                    # Few-shot Example 1: Typo
                    {
                        "role": "user",
                        "content": self._build_prompt(
                            "Undefined control sequence",
                            "\\includegrphics{image.png}",
                            {"contextLines": "\\begin{figure}\n\\includegrphics{image.png}\n\\end{figure}", "preamble": "\\usepackage{graphicx}"}
                        )
                    },
                    {
                        "role": "assistant",
                        "content": '{"explanation": "You misspelled the command. It should be includegraphics, not includegrphics.", "fix": "Correct the typo.", "fixed_code": "\\\\includegraphics{image.png}"}'
                    },
                    # Few-shot Example 2: Missing brace
                    {
                        "role": "user",
                        "content": self._build_prompt(
                            "Missing } inserted",
                            "\\textbf{Hello World",
                            {"contextLines": "This is \\textbf{Hello World\nMore text.", "preamble": ""}
                        )
                    },
                    {
                        "role": "assistant",
                        "content": '{"explanation": "You opened a curly brace { but forgot to close it with }.", "fix": "Add the missing closing brace.", "fixed_code": "\\\\textbf{Hello World}"}'
                    },
                    # Few-shot Example 3: Unknown environment
                    {
                        "role": "user",
                        "content": self._build_prompt(
                            "Environment itemize undefined",
                            "\\begin{itemze}",
                            {"contextLines": "\\begin{itemze}\n\\item First\n\\end{itemize}", "preamble": ""}
                        )
                    },
                    {
                        "role": "assistant",
                        "content": '{"explanation": "You misspelled the environment name. It should be itemize, not itemze.", "fix": "Correct the spelling.", "fixed_code": "\\\\begin{itemize}"}'
                    },
                    # Actual User Query
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

    def _get_system_prompt(self):
        return """You are a LaTeX debugging assistant for beginners. Your ONLY job is to:
1. Identify the exact syntax error in the provided LaTeX code.
2. Explain the error in ONE simple sentence (like explaining to a 5-year-old).
3. Provide the CORRECTED version of the broken line ONLY.

RULES:
- NEVER invent new LaTeX commands. Only fix existing ones.
- NEVER add packages or complex solutions. Keep fixes minimal.
- If you're unsure, focus on the most common mistake (typos, missing braces).
- Return ONLY valid JSON with keys: "explanation", "fix", "fixed_code".
- The "fixed_code" must be a SINGLE LINE, the corrected version of the broken line."""

    def _build_prompt(self, error, line, context):
        return f"""LaTeX Error: {error}
Broken Line: {line}

Surrounding Code:
{context.get('contextLines', 'N/A')}

Preamble (Package Definitions):
{context.get('preamble', 'N/A')}

Analyze the error and provide a fix."""

