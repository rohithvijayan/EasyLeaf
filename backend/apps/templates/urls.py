"""
Templates API URL routes.
"""
from django.urls import path
from .views import ListTemplatesView, TemplateZonesView, DetectTemplateView

urlpatterns = [
    path('', ListTemplatesView.as_view(), name='list-templates'),
    path('detect', DetectTemplateView.as_view(), name='detect-template'),
    path('<str:template_id>/zones', TemplateZonesView.as_view(), name='template-zones'),
]
