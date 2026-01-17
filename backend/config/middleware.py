"""
Private Network Access (PNA) Middleware for Chrome extensions
Adds headers to allow requests from public sites to localhost
"""

class PrivateNetworkAccessMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        
        # Add Private Network Access headers
        response['Access-Control-Allow-Private-Network'] = 'true'
        
        return response
