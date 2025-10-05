FROM httpd:2.4

# Create a simple index.html
RUN echo '<html><body><h1>Apache Blue/Green Deployment - Version 2.0</h1><p>This is running with automatic pipeline trigger! 🚀</p></body></html>' > /usr/local/apache2/htdocs/index.html

EXPOSE 80

CMD ["httpd-foreground"]