from rest_framework import views, status
from rest_framework.response import Response
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from .services import GroqService
import logging

logger = logging.getLogger(__name__)

@method_decorator(csrf_exempt, name='dispatch')
class ExplainErrorView(views.APIView):
    def post(self, request):
        """
        Analyze a LaTeX error and return a fix.
        Payload: {
            "error_message": str,
            "invalid_line": str,
            "context": { "preamble": str, "contextLines": str }
        }
        """
        logger.info(f"Received error explanation request from {request.META.get('HTTP_ORIGIN', 'unknown')}")
        
        data = request.data
        if not data.get('error_message'):
            return Response({"error": "Missing error_message"}, status=status.HTTP_400_BAD_REQUEST)

        service = GroqService()
        result = service.explain_error(
            data.get('error_message'),
            data.get('invalid_line', ''),
            data.get('context', {})
        )
        
        logger.info(f"Returning result: {result.get('explanation', '')[:50]}...")
        return Response(result)
