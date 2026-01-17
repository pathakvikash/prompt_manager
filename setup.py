from setuptools import setup, find_packages
import os

def read_readme():
    path = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'README.md')
    with open(path, encoding='utf-8') as f:
        return f.read()

setup(
    name='prompt_manager',
    version='0.1.0',
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        'Flask',
        'openai',
    ],
    entry_points={
        'console_scripts': [
            'prompt_manager=prompt_manager.main:main',
        ],
    },
    author='Vikash Pathak',
    author_email='pathakvikash821@gmail.com',
    description='A command-line application for managing prompts.',
    long_description=read_readme(),
    long_description_content_type='text/markdown',
    url='https://github.com/pathakvikash/prompt_manager',
    classifiers=[
        'Programming Language :: Python :: 3',
        'License :: OSI Approved :: MIT License',
        'Operating System :: OS Independent',
    ],
    python_requires='>=3.6',
)