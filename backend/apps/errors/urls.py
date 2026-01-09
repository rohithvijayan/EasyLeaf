"""
Error API URL routes.
"""
from django.urls import path
from .views import ExplainErrorView, FixErrorView, ErrorPatternsView

urlpatterns = [
    path('explain', ExplainErrorView.as_view(), name='explain-error'),
    path('fix', FixErrorView.as_view(), name='fix-error'),
    path('patterns', ErrorPatternsView.as_view(), name='error-patterns'),
]
