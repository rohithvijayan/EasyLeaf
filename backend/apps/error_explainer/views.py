from rest_framework import views, status
from rest_framework.response import Response
from .services import GroqService

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
        data = request.data
        if not data.get('error_message'):
            return Response({"error": "Missing error_message"}, status=status.HTTP_400_BAD_REQUEST)

        service = GroqService()
        result = service.explain_error(
            data.get('error_message'),
            data.get('invalid_line', ''),
            data.get('context', {})
        )
        
        return Response(result)
