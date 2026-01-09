"""
Snippet API views for generating LaTeX code.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import logging

logger = logging.getLogger(__name__)

# LaTeX snippet templates for different resume types
SNIPPET_TEMPLATES = {
    'jake-resume': {
        'education': '''\\resumeSubheading
      {{{institution}}}{{{location}}}
      {{{degree}}}{{{dates}}}
      {gpa_line}{coursework_line}''',
        
        'experience': '''\\resumeSubheading
      {{{company}}}{{{location}}}
      {{{role}}}{{{dates}}}
      \\resumeItemListStart
{bullets}      \\resumeItemListEnd''',
        
        'project': '''\\resumeProjectHeading
      {{\\textbf{{{name}}} $|$ \\emph{{{technologies}}}}}{{{link}}}
      \\resumeItemListStart
        \\resumeItem{{{description}}}
      \\resumeItemListEnd''',
        
        'skill': '''\\textbf{{{category}}}: {{{skills}}} \\\\'''
    },
    
    'deedy-cv': {
        'education': '''\\runsubsection{{{institution}}}
\\descript{{| {degree}}}
\\location{{{dates} | {location}}}
{gpa_line}''',
        
        'experience': '''\\runsubsection{{{company}}}
\\descript{{| {role}}}
\\location{{{dates} | {location}}}
\\begin{{tightemize}}
{bullets}\\end{{tightemize}}''',
        
        'skill': '''\\location{{{category}}}
{skills} \\\\'''
    },
    
    'altacv': {
        'education': '''\\cvevent{{{degree}}}{{{institution}}}{{{dates}}}{{{location}}}
{gpa_line}''',
        
        'experience': '''\\cvevent{{{role}}}{{{company}}}{{{dates}}}{{{location}}}
\\begin{{itemize}}
{bullets}\\end{{itemize}}''',
        
        'skill': '''\\cvskill{{{category}}}{{{skill_level}}}'''
    },
    
    'moderncv': {
        'education': '''\\cventry{{{dates}}}{{{degree}}}{{{institution}}}{{{location}}}{{{gpa}}}{{}}''',
        
        'experience': '''\\cventry{{{dates}}}{{{role}}}{{{company}}}{{{location}}}{{}}{{
{bullets}}}''',
        
        'skill': '''\\cvskill{{{category}}}{{{skills}}}'''
    },
    
    'simple': {
        'education': '''\\textbf{{{institution}}} \\hfill {{{location}}} \\\\
{degree} \\hfill {dates}
{gpa_line}{coursework_line}''',
        
        'experience': '''\\textbf{{{company}}} \\hfill {{{location}}} \\\\
\\textit{{{role}}} \\hfill {{{dates}}}
\\begin{itemize}
{bullets}\\end{itemize}''',
        
        'project': '''\\textbf{{{name}}} \\hfill {{{link}}} \\\\
\\textbf{{Tech Stack}}: \\textit{{{technologies}}}
\\begin{itemize}
    \\item {{{description}}}
\\end{itemize}''',
        
        'skill': '''\\textbf{{{category}}}: {skills}'''
    }
}

# Default to simple for better compatibility
DEFAULT_TEMPLATE = 'simple'


class GenerateSnippetView(APIView):
    """
    POST /api/v1/snippets/generate
    
    Generate LaTeX code from structured data.
    """
    
    def post(self, request):
        data = request.data
        
        snippet_type = data.get('type')
        snippet_data = data.get('data', {})
        template_type = data.get('template_type', DEFAULT_TEMPLATE)
        
        if not snippet_type:
            return Response(
                {'error': 'type is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not snippet_data:
            return Response(
                {'error': 'data is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            latex = self.generate_latex(snippet_type, snippet_data, template_type)
            
            return Response({
                'latex': latex,
                'type': snippet_type,
                'template': template_type,
                'preview_text': self.generate_preview(snippet_type, snippet_data)
            })
            
        except Exception as e:
            logger.error(f"Error generating snippet: {e}")
            return Response(
                {'error': 'Failed to generate snippet', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def generate_latex(self, snippet_type: str, data: dict, template_type: str) -> str:
        """Generate LaTeX code from template and data."""
        templates = SNIPPET_TEMPLATES.get(template_type, SNIPPET_TEMPLATES[DEFAULT_TEMPLATE])
        template = templates.get(snippet_type)
        
        if not template:
            raise ValueError(f"Unknown snippet type: {snippet_type}")
        
        # Process special fields
        if snippet_type == 'education':
            data['gpa_line'] = f"\\textit{{GPA: {data.get('gpa', '')}}}" if data.get('gpa') else ''
            data['coursework_line'] = f"\\\\\\textit{{Coursework: {data.get('coursework', '')}}}" if data.get('coursework') else ''
        
        elif snippet_type == 'experience':
            bullets = []
            item_cmd = '\\item ' if template_type == 'simple' else '\\resumeItem'
            
            for key in ['bullet1', 'bullet2', 'bullet3']:
                if data.get(key):
                    if template_type == 'simple':
                        bullets.append(f"    \\item {data[key]}")
                    else:
                        bullets.append(f"        \\resumeItem{{{data[key]}}}")
            data['bullets'] = '\n'.join(bullets) + '\n' if bullets else ''
        
        elif snippet_type == 'project':
            data['link'] = f"\\href{{{data.get('link', '')}}}{{{data.get('link', '')}}}" if data.get('link') else ''
        
        # Fill template
        result = template
        for key, value in data.items():
            result = result.replace('{' + key + '}', str(value or ''))
            result = result.replace('{{' + key + '}}', str(value or ''))
            result = result.replace('{{{' + key + '}}}', str(value or ''))
        
        result = result.strip()
        
        # Add section header if requested
        if data.get('include_header'):
            headers = {
                'education': 'Education',
                'experience': 'Experience',
                'project': 'Projects',
                'skill': 'Skills'
            }
            header_title = headers.get(snippet_type, snippet_type.capitalize())
            
            # Use appropriate section command based on template
            if template_type == 'jake-resume':
                result = f"\\section{{{header_title}}}\n{result}"
            elif template_type == 'deedy-cv':
                result = f"\\section{{{header_title}}}\n{result}"
            else:
                 # Standard LaTeX section
                result = f"\\section*{{{header_title}}}\n{result}"
                
        return result
    
    def generate_preview(self, snippet_type: str, data: dict) -> str:
        """Generate a plain-text preview of the snippet."""
        if snippet_type == 'education':
            return f"{data.get('institution', 'Institution')} - {data.get('degree', 'Degree')}"
        elif snippet_type == 'experience':
            return f"{data.get('company', 'Company')} - {data.get('role', 'Role')}"
        elif snippet_type == 'project':
            return f"{data.get('name', 'Project')} ({data.get('technologies', 'Tech')})"
        elif snippet_type == 'skill':
            return f"{data.get('category', 'Category')}: {data.get('skills', 'Skills')}"
        return snippet_type


class ListSnippetsView(APIView):
    """
    GET /api/v1/snippets/
    
    List available snippet types and templates.
    """
    
    def get(self, request):
        category = request.query_params.get('category')
        
        snippets = [
            {
                'type': 'education',
                'category': 'resume',
                'name': 'Education Entry',
                'fields': ['institution', 'location', 'degree', 'dates', 'gpa', 'coursework'],
                'description': 'Add an education entry'
            },
            {
                'type': 'experience',
                'category': 'resume',
                'name': 'Work Experience',
                'fields': ['company', 'location', 'role', 'dates', 'bullet1', 'bullet2', 'bullet3'],
                'description': 'Add a work experience entry'
            },
            {
                'type': 'project',
                'category': 'resume',
                'name': 'Project Entry',
                'fields': ['name', 'technologies', 'description', 'link'],
                'description': 'Add a project'
            },
            {
                'type': 'skill',
                'category': 'resume',
                'name': 'Skill Category',
                'fields': ['category', 'skills'],
                'description': 'Add a skill category'
            }
        ]
        
        if category:
            snippets = [s for s in snippets if s['category'] == category]
        
        return Response({
            'snippets': snippets,
            'templates': list(SNIPPET_TEMPLATES.keys())
        })
