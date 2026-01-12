import pytest
from unittest.mock import MagicMock, patch
from rest_framework import status
from rest_framework.test import APIClient
from apps.error_explainer.services import GroqService

# --- GroqService Tests ---

@patch('apps.error_explainer.services.Groq')
def test_groq_service_call(mock_groq_class):
    # Setup Mock
    mock_client = MagicMock()
    mock_groq_class.return_value = mock_client
    
    mock_response = MagicMock()
    mock_response.choices[0].message.content = '{"explanation": "Fix usage", "fix": "Delete it", "fixed_code": ""}'
    mock_client.chat.completions.create.return_value = mock_response

    # Test
    service = GroqService()
    service.api_key = "test-key" # Force key presence
    service.client = mock_client
    
    result = service.explain_error(
        "Undefined control sequence", 
        "\\mistake", 
        {"contextLines": "line1\nline2"}
    )
    
    assert result['explanation'] == "Fix usage"
    assert result['fix'] == "Delete it"
    assert mock_client.chat.completions.create.called

def test_groq_service_missing_key():
    with patch.dict('os.environ', {}, clear=True):
        service = GroqService()
        result = service.explain_error("Error", "\\line", {})
        assert "AI service is not configured" in result['explanation']

# --- API View Tests ---

@pytest.mark.django_db
class TestExplainErrorView:
    def setup_method(self):
        self.client = APIClient()
        self.url = '/api/v1/debugger/explain/'

    @patch('apps.error_explainer.views.GroqService.explain_error')
    def test_explain_error_success(self, mock_explain):
        mock_explain.return_value = {
            "explanation": "Test Explanation",
            "fix": "Test Fix",
            "fixed_code": "Fixed"
        }

        payload = {
            "error_message": "Undefined control sequence",
            "invalid_line": "\\oops",
            "context": {"preamble": "", "contextLines": ""}
        }

        response = self.client.post(self.url, payload, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['explanation'] == "Test Explanation"

    def test_explain_error_missing_data(self):
        response = self.client.post(self.url, {}, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST
