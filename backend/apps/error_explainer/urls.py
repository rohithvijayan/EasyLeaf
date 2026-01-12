from django.urls import path
from .views import ExplainErrorView

urlpatterns = [
    path('explain/', ExplainErrorView.as_view(), name='explain_error'),
]
