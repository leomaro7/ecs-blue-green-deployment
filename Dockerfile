FROM httpd:2.4

# Copy custom configuration if needed
COPY ./public-html/ /usr/local/apache2/htdocs/

# Create a simple index.html if it doesn't exist
RUN echo '<html><body><h1>Apache Blue/Green Deployment - Version 1.0</h1><p>This is running from the Blue environment.</p></body></html>' > /usr/local/apache2/htdocs/index.html

EXPOSE 80

CMD ["httpd-foreground"]