/* global Sanitize */

if(!Sanitize.Config) {
  Sanitize.Config = {};
}

Sanitize.Config.MAIL = {
    elements: ['p', 'a', 'h1', 'h2', 'h3', 'div', 'h4', 'h5', 'h6', 'hr', 
        'blockquote', 'span', 'br', 'table', 'tbody', 'tfoot', 'thead', 'th', 
        'td', 'tr', 'u', 'ul', 'li', 'dd', 'dl', 'dt', 'ol', 'em', 'i', 'b', 
        'strong', 'code'],

    attributes: {
        'p': ['style'], 
        'a': ['style', 'href'], 
        'h1': ['style'], 
        'h2': ['style'], 
        'h3': ['style'], 
        'div': ['style'], 
        'h4': ['style'], 
        'h5': ['style'], 
        'h6': ['style'], 
        'hr': ['style'], 
        'blockquote': ['style', 'cite'], 
        'span': ['style'], 
        'br': ['style'], 
        'table': ['style'], 
        'tbody': ['style'], 
        'tfoot': ['style'], 
        'thead': ['style'], 
        'th': ['style'], 
        'td': ['style'], 
        'tr': ['style'], 
        'u': ['style'], 
        'ul': ['style'], 
        'li': ['style'], 
        'dd': ['style'], 
        'dl': ['style'], 
        'dt': ['style'], 
        'ol': ['style'], 
        'em': ['style'], 
        'i': ['style'], 
        'b': ['style'], 
        'strong': ['style'], 
        'code': ['style'],
        'img': ['style', 'alt', 'height', 'src', 'width']
    },

    protocols: {
      'a'         : {'href': ['ftp', 'http', 'https', 'mailto',
                                  Sanitize.RELATIVE]},
      'blockquote': {'cite': ['http', 'https', Sanitize.RELATIVE]},
      'img'       : {'src' : ['http', 'https', Sanitize.RELATIVE]},
      'q'         : {'cite': ['http', 'https', Sanitize.RELATIVE]}
    }
};


Sanitize.Config.CHAT = {
    elements: [],

    attributes: {},

    protocols: {}
};