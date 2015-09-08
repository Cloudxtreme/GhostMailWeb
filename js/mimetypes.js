function mimeTypeToIcon(mimeType) {
    var icon = "";
    switch(mimeType) {
        case 'image/gif':
        case 'image/jpeg':
        case 'image/pjpeg':
        case 'image/png':
        case 'image/bmp':
        case 'image/svg+xml':
        case 'image/tiff':
            icon = 'fa-file-image-o'; break;
        case 'audio/mp4':
        case 'audio/mpeg':
        case 'audio/ogg':
        case 'audio/vnd.wave':
            icon = 'fa-file-sound-o'; break;
        case 'video/avi':
        case 'video/mpeg':
        case 'video/mp4':
        case 'video/ogg':
        case 'video/quicktime':
        case 'video/x-ms-wmv':
        case 'video/x-flv':
            icon = 'fa-file-video-o'; break;
            
        case 'application/vnd.ms-excel':
        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
            icon = 'fa-file-excel-o'; break;
        case 'application/pdf':
            icon = 'fa-file-pdf-o'; break;
        case 'application/msword':
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':    
            icon = 'fa-file-word-o'; break;
        case 'application/zip':
        case 'application/gzip':
        case 'application/x-7z-compressed':
        case 'application/x-rar-compressed':
        case 'application/x-tar':
            icon = 'fa-file-archive-o'; break;
            
            icon = 'fa-file-text-o'; break;
        case 'text/css':
        case 'text/html':
        case 'text/javascript':
        case 'application/javascript':
        case 'text/xml':
            icon = 'fa-file-code-o'; break;
        case 'text/plain':
            icon = 'fa-file-text-o'; break;
        case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        case 'application/vnd.ms-powerpoint':    
            icon = 'fa-file-powerpoint-o'; break;
            
        default: icon = 'fa-file-o'; break;
    }
    return icon;
}


