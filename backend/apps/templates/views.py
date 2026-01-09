"""
Template API views for zone definitions.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import re
import logging

logger = logging.getLogger(__name__)

# Template zone definitions for all 5 supported templates
TEMPLATE_ZONES = {
    'jake-resume': {
        'template_id': 'jake-resume',
        'template_name': "Jake's Resume",
        'source': 'https://www.overleaf.com/latex/templates/jakes-resume/syzfjbzwjncs',
        'zones': [
            {
                'type': 'locked',
                'patterns': [r'\\documentclass', r'\\begin\{document\}', r'\\end\{document\}'],
                'description': 'Core document structure'
            },
            {
                'type': 'warning',
                'start_line': 1,
                'end_pattern': r'\\begin\{document\}',
                'description': 'Preamble - formatting settings'
            },
            {
                'type': 'safe',
                'marker': '%-----------HEADING-----------',
                'fields': ['name', 'phone', 'email', 'linkedin', 'github'],
                'description': 'Your contact information'
            },
            {
                'type': 'safe',
                'marker': '%-----------EDUCATION-----------',
                'fields': ['institution', 'degree', 'date', 'gpa', 'coursework'],
                'description': 'Education section'
            },
            {
                'type': 'safe',
                'marker': '%-----------EXPERIENCE-----------',
                'fields': ['company', 'role', 'dates', 'bullets'],
                'description': 'Work experience'
            },
            {
                'type': 'safe',
                'marker': '%-----------PROJECTS-----------',
                'fields': ['name', 'tech', 'description', 'bullets'],
                'description': 'Projects section'
            },
            {
                'type': 'safe',
                'marker': '%-----------SKILLS-----------',
                'fields': ['category', 'skills'],
                'description': 'Technical skills'
            }
        ]
    },
    
    'deedy-cv': {
        'template_id': 'deedy-cv',
        'template_name': 'Deedy CV',
        'source': 'https://www.overleaf.com/latex/templates/deedy-cv/bjryvfsjdyxz',
        'zones': [
            {
                'type': 'locked',
                'patterns': [r'\\documentclass', r'\\begin\{document\}', r'\\end\{document\}', r'\\namesection'],
                'description': 'Core document structure'
            },
            {
                'type': 'safe',
                'patterns': [r'\\runsubsection', r'\\descript', r'\\location'],
                'description': 'Content sections'
            }
        ]
    },
    
    'altacv': {
        'template_id': 'altacv',
        'template_name': 'AltaCV',
        'source': 'https://www.overleaf.com/latex/templates/altacv-template/trgqjpwnmtgv',
        'zones': [
            {
                'type': 'locked',
                'patterns': [r'\\documentclass', r'\\makecvheader', r'\\begin\{document\}'],
                'description': 'Core document and header'
            },
            {
                'type': 'safe',
                'patterns': [r'\\cvevent', r'\\cvskill', r'\\cvtag'],
                'description': 'Content entries'
            }
        ]
    },
    
    'moderncv': {
        'template_id': 'moderncv',
        'template_name': 'ModernCV',
        'source': 'https://ctan.org/pkg/moderncv',
        'zones': [
            {
                'type': 'locked',
                'patterns': [r'\\documentclass', r'\\moderncvstyle', r'\\moderncvcolor'],
                'description': 'CV style settings'
            },
            {
                'type': 'safe',
                'patterns': [r'\\cventry', r'\\cvitem', r'\\cvskill'],
                'description': 'Content entries'
            }
        ]
    },
    
    'simple': {
        'template_id': 'simple',
        'template_name': 'Simple Overleaf',
        'source': 'https://www.overleaf.com/templates/simple-cv/kzwpwnfdtbmq',
        'zones': [
            {
                'type': 'locked',
                'patterns': [r'\\documentclass', r'\\begin\{document\}', r'\\end\{document\}'],
                'description': 'Core structure'
            },
            {
                'type': 'safe',
                'patterns': [r'\\section', r'\\subsection', r'\\textbf'],
                'description': 'Content sections'
            }
        ]
    }
}


class ListTemplatesView(APIView):
    """
    GET /api/v1/templates/
    
    List all supported templates.
    """
    
    def get(self, request):
        templates = []
        for template_id, data in TEMPLATE_ZONES.items():
            templates.append({
                'id': template_id,
                'name': data['template_name'],
                'source': data.get('source', ''),
                'zone_count': len(data.get('zones', []))
            })
        
        return Response({'templates': templates})


class TemplateZonesView(APIView):
    """
    GET /api/v1/templates/{template_id}/zones
    
    Get zone definitions for a specific template.
    """
    
    def get(self, request, template_id):
        template = TEMPLATE_ZONES.get(template_id)
        
        if not template:
            return Response(
                {'error': f'Template not found: {template_id}'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        return Response(template)


class DetectTemplateView(APIView):
    """
    POST /api/v1/templates/detect
    
    Detect template type from content.
    """
    
    def post(self, request):
        content = request.data.get('content', '')
        
        if not content:
            return Response(
                {'error': 'content is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Detection patterns
        detections = [
            ('jake-resume', r'resumeSubheading|%-+.*-+'),
            ('deedy-cv', r'deedy|\\namesection'),
            ('altacv', r'altacv|\\makecvheader'),
            ('moderncv', r'moderncv|\\cventry'),
            ('simple', r'\\documentclass\{article\}'),
        ]
        
        for template_id, pattern in detections:
            if re.search(pattern, content, re.IGNORECASE):
                return Response({
                    'template_id': template_id,
                    'template_name': TEMPLATE_ZONES[template_id]['template_name'],
                    'confidence': 0.9 if template_id != 'simple' else 0.6
                })
        
        return Response({
            'template_id': 'unknown',
            'template_name': 'Unknown Template',
            'confidence': 0.0
        })
