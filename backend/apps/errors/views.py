"""
Error API views for EasyLeaf.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from services.llm_service import llm_service
import logging

logger = logging.getLogger(__name__)


class ExplainErrorView(APIView):
    """
    POST /api/v1/errors/explain
    
    Explain a LaTeX error in plain English using LLM.
    """
    
    def post(self, request):
        data = request.data
        
        # Validate required fields
        error_message = data.get('error_message')
        if not error_message:
            return Response(
                {'error': 'error_message is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Extract optional fields
        error_line = data.get('error_line')
        context_before = data.get('context_before', '')
        context_after = data.get('context_after', '')
        template_type = data.get('template_type')
        model_tier = data.get('model_tier', 'balanced')
        
        # Combine context
        context = f"{context_before}\n>>> ERROR LINE <<<\n{context_after}"
        
        try:
            # Get LLM explanation
            result = llm_service.explain_error(
                error_message=error_message,
                error_line=error_line,
                context=context,
                template_type=template_type,
                model_tier=model_tier
            )
            
            return Response(result)
            
        except Exception as e:
            logger.error(f"Error in explain endpoint: {e}")
            return Response(
                {'error': 'Failed to explain error', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class FixErrorView(APIView):
    """
    POST /api/v1/errors/fix
    
    Generate a fix for a LaTeX error.
    """
    
    def post(self, request):
        data = request.data
        
        error_message = data.get('error_message')
        if not error_message:
            return Response(
                {'error': 'error_message is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # For now, use the same explain endpoint
        # In future, could have specialized fix logic
        result = llm_service.explain_error(
            error_message=error_message,
            error_line=data.get('error_line'),
            context=data.get('context', ''),
            template_type=data.get('template_type')
        )
        
        # Extract just the fix suggestion
        if 'suggested_fix' in result:
            return Response({
                'fix': result['suggested_fix'],
                'explanation': result.get('explanation', '')
            })
        
        return Response({
            'error': 'No fix suggestion available',
            'explanation': result.get('explanation', 'Unable to generate fix')
        })


class ErrorPatternsView(APIView):
    """
    GET /api/v1/errors/patterns
    
    Get common error patterns for client-side caching.
    """
    
    def get(self, request):
        # Return common patterns for client-side matching
        patterns = [
            {
                'pattern': 'Missing }',
                'type': 'syntax',
                'severity': 'error',
                'quick_fix': 'Add missing closing brace'
            },
            {
                'pattern': 'Undefined control sequence',
                'type': 'command',
                'severity': 'error',
                'quick_fix': 'Check command spelling or add package'
            },
            {
                'pattern': 'Missing $ inserted',
                'type': 'math',
                'severity': 'error',
                'quick_fix': 'Wrap math content in $ signs'
            },
            {
                'pattern': 'Extra }',
                'type': 'syntax',
                'severity': 'error',
                'quick_fix': 'Remove extra closing brace'
            },
            {
                'pattern': 'File .* not found',
                'type': 'file',
                'severity': 'error',
                'quick_fix': 'Upload missing file or fix path'
            },
            {
                'pattern': 'Overfull \\\\hbox',
                'type': 'layout',
                'severity': 'warning',
                'quick_fix': 'Content too wide, may need reformatting'
            },
            {
                'pattern': 'Underfull \\\\hbox',
                'type': 'layout',
                'severity': 'warning',
                'quick_fix': 'Line has too much space'
            }
        ]
        
        return Response({'patterns': patterns})
