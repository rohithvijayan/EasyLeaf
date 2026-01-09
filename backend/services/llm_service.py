"""
Groq LLM Service for LaTeX error explanation and fixes.
"""
import json
import hashlib
import logging
from typing import Optional
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

# Try to import groq, handle if not installed
try:
    from groq import Groq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False
    logger.warning("Groq package not installed. LLM features will use fallback responses.")


class LLMService:
    """Service for LLM-powered error explanation and fixes using Groq."""
    
    SYSTEM_PROMPT = """You are a helpful LaTeX tutor explaining errors to complete beginners.

Guidelines:
- Use simple, non-technical language a student would understand
- Reference specific parts of their code by quoting it
- Explain what they were trying to do
- Provide actionable fix instructions
- Keep explanations under 3 sentences
- Be encouraging, not condescending

Respond ONLY with valid JSON in this exact format:
{
    "explanation": "plain English explanation of what went wrong",
    "severity": "error",
    "suggested_fix": {
        "description": "what to change",
        "diff": "- old line\\n+ new line",
        "confidence": 0.95
    },
    "learning_tip": "brief educational note about this error type"
}"""

    # Available Groq models (free tier)
    MODELS = {
        'fast': 'llama-3.1-8b-instant',
        'balanced': 'llama-3.3-70b-versatile',
        'quality': 'mixtral-8x7b-32768',
    }
    
    def __init__(self):
        self.client = None
        self.default_model = self.MODELS['balanced']
        
        if GROQ_AVAILABLE and settings.GROQ_API_KEY:
            try:
                self.client = Groq(api_key=settings.GROQ_API_KEY)
                logger.info("Groq client initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize Groq client: {e}")
    
    def explain_error(
        self,
        error_message: str,
        error_line: Optional[int] = None,
        context: str = "",
        template_type: Optional[str] = None,
        model_tier: str = 'balanced'
    ) -> dict:
        """
        Explain a LaTeX error in plain English.
        
        Args:
            error_message: The raw LaTeX error message
            error_line: Line number where error occurred
            context: Surrounding code context
            template_type: Type of resume template (jake-resume, deedy, etc.)
            model_tier: Which model to use (fast, balanced, quality)
            
        Returns:
            dict with explanation, severity, suggested_fix, learning_tip
        """
        # Check cache first
        cache_key = self._generate_cache_key(error_message, context)
        cached = cache.get(cache_key)
        if cached:
            logger.debug(f"Cache hit for error: {error_message[:50]}")
            return {**cached, 'cached': True}
        
        # If no Groq client, use fallback
        if not self.client:
            logger.warning("No Groq client available, using fallback")
            return self._get_fallback_response(error_message)
        
        # Build prompt
        prompt = self._build_prompt(error_message, error_line, context, template_type)
        
        try:
            response = self.client.chat.completions.create(
                model=self.MODELS.get(model_tier, self.default_model),
                messages=[
                    {"role": "system", "content": self.SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=500,
                response_format={"type": "json_object"}
            )
            
            result_text = response.choices[0].message.content
            result = json.loads(result_text)
            
            # Validate response structure
            if 'explanation' not in result:
                result['explanation'] = "An error occurred in your document."
            if 'severity' not in result:
                result['severity'] = 'error'
            
            # Cache for 24 hours
            cache.set(cache_key, result, 60 * 60 * 24)
            logger.info(f"LLM response cached for: {error_message[:50]}")
            
            return {**result, 'cached': False}
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response as JSON: {e}")
            return self._get_fallback_response(error_message)
        except Exception as e:
            logger.error(f"LLM API error: {e}")
            return self._get_fallback_response(error_message)
    
    def _build_prompt(
        self, 
        error_message: str, 
        error_line: Optional[int], 
        context: str, 
        template_type: Optional[str]
    ) -> str:
        """Build the prompt for the LLM."""
        template_hint = f"\nThis is a {template_type} resume template." if template_type else ""
        line_hint = f"\nError on line {error_line}." if error_line else ""
        
        return f"""LaTeX compile error:

Error message: {error_message}{line_hint}{template_hint}

Code context:
```latex
{context[:500] if context else 'No context available'}
```

Explain this error to a complete beginner and suggest how to fix it."""

    def _generate_cache_key(self, error_message: str, context: str) -> str:
        """Generate a cache key for the error."""
        content = f"{error_message}:{context[:200]}"
        hash_val = hashlib.md5(content.encode()).hexdigest()
        return f"latex_error:{hash_val}"
    
    def _get_fallback_response(self, error_message: str) -> dict:
        """Return a pre-built response for common errors."""
        error_lower = error_message.lower()
        
        patterns = {
            'missing }': {
                'explanation': 'You forgot to close a curly brace somewhere. Every { needs a matching }.',
                'severity': 'error',
                'suggested_fix': {
                    'description': 'Look for an opening { and add the missing }',
                    'diff': '- \\begin{itemize\n+ \\begin{itemize}',
                    'confidence': 0.8
                },
                'learning_tip': 'In LaTeX, curly braces {} always come in pairs. Missing one will break your document.'
            },
            'undefined control sequence': {
                'explanation': "You used a command that LaTeX doesn't recognize. This usually means a typo or missing package.",
                'severity': 'error',
                'suggested_fix': {
                    'description': 'Check the spelling of your command',
                    'diff': '- \\texbf{text}\n+ \\textbf{text}',
                    'confidence': 0.7
                },
                'learning_tip': 'LaTeX commands start with \\. Make sure you spelled it correctly!'
            },
            'missing $ inserted': {
                'explanation': 'You used a math symbol outside of math mode. Wrap it in $ signs.',
                'severity': 'error',
                'suggested_fix': {
                    'description': 'Add $ around the math content',
                    'diff': '- x^2\n+ $x^2$',
                    'confidence': 0.9
                },
                'learning_tip': 'Math symbols like ^, _, and Greek letters need to be inside $...$ or \\[...\\].'
            },
            'extra }': {
                'explanation': 'You have an extra closing brace } that doesn\'t match an opening one.',
                'severity': 'error',
                'suggested_fix': {
                    'description': 'Remove the extra } or add the missing {',
                    'diff': '- text}}\n+ text}',
                    'confidence': 0.8
                },
                'learning_tip': 'Count your braces! Every { needs exactly one matching }.'
            },
            'missing \\begin{document}': {
                'explanation': 'Your document is missing the \\begin{document} command that starts the content.',
                'severity': 'error',
                'suggested_fix': {
                    'description': 'Add \\begin{document} after your preamble',
                    'diff': '+ \\begin{document}',
                    'confidence': 0.95
                },
                'learning_tip': 'Every LaTeX document needs \\begin{document} and \\end{document}.'
            },
            'file not found': {
                'explanation': 'LaTeX is trying to load a file that doesn\'t exist. Check if you uploaded all your files.',
                'severity': 'error',
                'learning_tip': 'Make sure all files referenced in your document are uploaded to Overleaf.'
            },
            'environment': {
                'explanation': 'There\'s a problem with how you opened or closed an environment (like itemize, enumerate, etc.).',
                'severity': 'error',
                'suggested_fix': {
                    'description': 'Make sure \\begin{...} has a matching \\end{...}',
                    'diff': '- \\begin{itemize}\n- \\item One\n+ \\begin{itemize}\n+ \\item One\n+ \\end{itemize}',
                    'confidence': 0.8
                },
                'learning_tip': 'Every \\begin{something} needs a matching \\end{something}.'
            }
        }
        
        for pattern, response in patterns.items():
            if pattern in error_lower:
                return {**response, 'cached': True, 'fallback': True}
        
        # Generic fallback
        return {
            'explanation': "There's an error in your document. Check the highlighted line for issues like missing brackets, typos, or incorrect commands.",
            'severity': 'error',
            'learning_tip': 'LaTeX errors usually point to the line where the problem is. Look carefully at that line and the ones before it.',
            'cached': True,
            'fallback': True
        }


# Singleton instance
llm_service = LLMService()
