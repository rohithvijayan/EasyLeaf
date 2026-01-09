"""
Snippets API URL routes.
"""
from django.urls import path
from .views import GenerateSnippetView, ListSnippetsView

urlpatterns = [
    path('', ListSnippetsView.as_view(), name='list-snippets'),
    path('generate', GenerateSnippetView.as_view(), name='generate-snippet'),
]
