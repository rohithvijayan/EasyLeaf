"""
URL configuration for EasyLeaf backend.
"""
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include([
        path('errors/', include('apps.errors.urls')),
        path('templates/', include('apps.templates.urls')),
        path('snippets/', include('apps.snippets.urls')),
        path('debugger/', include('apps.error_explainer.urls')),
    ])),
]
