from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('convert/', views.convert_video, name='convert_video'),
    path('history/', views.conversion_history, name='conversion_history'),
    path('delete/<int:pk>/', views.delete_conversion, name='delete_conversion'),
]
