function Visual(options) {
  'use strict';

  var def = Object.defineProperty;


  if (!options.getBlock) {
    options.getBlock = function(name) {
      var b = options.blocks[name];
      return b.slice(0, 2).concat(name, b.slice(2));
    };
  }


  function el(tagName, className) {
    var d = document.createElement(className ? tagName : 'div');
    d.className = className || tagName || '';
    return d;
  }

  function setTransform(el, transform) {
    el.style.WebkitTransform =
    el.style.MozTransform =
    el.style.MSTransform =
    el.style.OTransform =
    el.style.transform = transform;
  }

  function bezel(context, path, thisArg, inset, insetColor) {
    var s = inset ? -1 : 1;
    var w = context.canvas.width;
    var h = context.canvas.height;

    context.beginPath();
    path.call(thisArg, context);
    context.fill();

    context.beginPath();
    context.moveTo(-3, -3);
    context.lineTo(-3, h+3);
    context.lineTo(w+3, h+3);
    context.lineTo(w+3, -3);
    context.closePath();
    path.call(thisArg, context);

    if (insetColor) context.fillStyle = insetColor;
    context.globalCompositeOperation = 'source-atop';

    context.shadowOffsetX = s * 1;
    context.shadowOffsetY = s * 1;
    context.shadowBlur = 1;
    context.shadowColor = 'rgba(255, 255, 255, .4)';
    context.fill();

    context.shadowOffsetX = s * -1;
    context.shadowOffsetY = s * -1;
    context.shadowBlur = 1;
    context.shadowColor = 'rgba(0, 0, 0, .4)';
    context.fill();
  }


  function Block(info) {
    this.el = el('Visual-block');
    this.el.appendChild(this.canvas = el('canvas', 'Visual-canvas'));
    this.context = this.canvas.getContext('2d');

    if (typeof info === 'string') info = options.getBlock(info);

    this.type = info[0];
    this.spec = info[1];
    this.name = info[2];
  }

  var PI12 = Math.PI * 1/2;
  var PI = Math.PI;
  var PI32 = Math.PI * 3/2;

  Block.prototype = {
    constructor: Block,

    blockClasses: {
      c: 'Visual-command Visual-puzzled Visual-block',
      f: 'Visual-command Visual-block',
      r: 'Visual-part Visual-block',
      b: 'Visual-part Visual-block'
    },

    isArg: false,
    isBlock: true,
    isScript: false,
    isWorkspace: false,

    parent: null,

    radius: 4,
    puzzle: 3,
    puzzleWidth: 10,
    puzzleInset: 12,

    pathBlockType: {
      c: function(context) {
        this.pathCommandShape(true, context);
      },
      f: function(context) {
        this.pathCommandShape(false, context);
      }
    },

    pathCommandShape: function(bottom, context) {
      var r = this.radius;
      var p = this.puzzle;
      var pi = this.puzzleInset;
      var pw = this.puzzleWidth;
      var w = this.width;
      var h = this.height - bottom * p;
      context.moveTo(0, r);
      context.arc(r, r, r, PI, PI32, false);
      context.lineTo(pi, 0);
      context.lineTo(pi + p, p);
      context.lineTo(pi + pw + p, p);
      context.lineTo(pi + pw + p * 2, 0);
      context.arc(w - r, r, r, PI32, 0, false);
      context.arc(w - r, h - r, r, 0, PI12, false);
      if (bottom) {
        context.lineTo(pi + pw + p * 2, h);
        context.lineTo(pi + pw + p, h + p);
        context.lineTo(pi + p, h + p);
        context.lineTo(pi, h);
      }
      context.arc(r, h - r, r, PI12, PI, false);
    },

    get spec() {return this._spec},
    set spec(value) {
      this._spec = value;

      var args = this.args || [];
      this.args = [];
      this.labels = [];
      this.parts = [];

      var parts = value.split(/(?:@(\w+)|%(\w+(?:\.\w+)?))/g);
      var i = 0;
      for (;;) {
        if (parts[i]) {
          this.add(new Label(parts[i]));
        }
        i++;
        if (i >= parts.length) break;
        if (parts[i]) {
          this.add(new Icon(parts[i]))
        }
        i++;
        if (parts[i]) {
          var old = args[this.args.length];
          this.add(old && old.isArg ? old : new Arg(parts[i]));
        }
        i++;
      }
    },

    get type() {return this._type},
    set type(value) {
      this._type = value;

      this.el.className = this.blockClasses[value];
    },

    get workspace() {return this.parent && this.parent.workspace},

    add: function(part) {
      part.parent = this;
      this.parts.push(part);

      if (part.isBlock || part.isArg) {
        this.args.push(part);
      } else {
        this.labels.push(part);
      }

      this.el.appendChild(part.el);
      this.layout();

      return this;
    },

    layout: function() {
      if (!this.parent) return;
      this.layoutSelf();
      this.parent.layout();
    },

    layoutChildren: function() {
      this.parts.forEach(function(p) {
        p.layoutChildren();
      });
      this.layoutSelf();
    },

    layoutSelf: function() {
      var bb = this.el.getBoundingClientRect();
      this.width = bb.width;
      this.height = bb.height;

      this.draw();
    },

    draw: function() {
      this.canvas.width = this.width;
      this.canvas.height = this.height;

      this.context.fillStyle = '#e1a91a';
      bezel(this.context, this.pathBlockType[this._type], this);
    }
  };


  function Label(text) {
    this.el = el('Visual-part Visual-label');

    this.text = text;
  }

  Label.prototype = {
    constructor: Label,

    isArg: false,
    isBlock: false,
    isScript: false,
    isWorkspace: false,

    parent: null,

    get text() {return this._text},
    set text(value) {
      this.el.textContent = value;
      this._text = value;
    },

    get workspace() {return this.parent && this.parent.workspace},

    layoutChildren: function() {},

    layout: function() {if (this.parent) this.parent.layout()}
  };


  function Arg(info) {
    this.el = el();
    this.el.appendChild(this.canvas = el('canvas', 'Visual-canvas'));
    this.context = this.canvas.getContext('2d');

    if (typeof info === 'string') info = info.split('.');
    this.type = info[0];
    this.menu = info[1];
  }

  Arg.prototype = {
    constructor: Arg,

    argClasses: {
      b: 'Visual-part',
      c: 'Visual-part Visual-color-arg',
      d: 'Visual-part Visual-field-arg Visual-numeric-arg Visual-with-menu',
      m: 'Visual-part Visual-enum-arg',
      n: 'Visual-part Visual-field-arg Visual-numeric-arg',
      s: 'Visual-part Visual-field-arg Visual-string-arg',
      t: 'Visual-script-arg',
    },

    pathArgType: {
      b: 'pathBooleanShape',
      c: 'pathRectShape',
      n: 'pathRoundedShape',
      d: 'pathRoundedShape',
      m: 'pathRectShape',
      s: 'pathRectShape'
    },

    isArg: true,
    isBlock: false,
    isScript: false,
    isWorkspace: false,

    parent: null,

    get type() {return this._type},
    set type(value) {
      this._type = value;

      if (this.field) this.el.removeChild(this.field);
      this.el.className = this.argClasses[value];

      switch (this.type) {
        case 's':
        case 'n':
        case 'd':
          this.field = el('input', 'Visual-field Visual-text-field');
          this.field.addEventListener('input', this.layout.bind(this));
          break;
        case 'c':
          this.field = el('input', 'Visual-field Visual-color-field');
          this.field.type = 'color';
          this.field.addEventListener('input', this.draw.bind(this));
          break;
      }
      if (this.field) this.el.appendChild(this.field);

      this.layout();
    },

    get workspace() {return this.parent && this.parent.workspace},

    draw: function() {
      this.canvas.width = this.width;
      this.canvas.height = this.height;

      if (this._type === 't') {
        return;
      }

      var field = this._type !== 'c' && this._type !== 'm';

      this.context.fillStyle =
        field ? '#fff' :
        this._type === 'c' ? this.field.value : 'rgba(0, 0, 0, .2)';
      bezel(this.context, this[this.pathArgType[this._type]], this, true, field ? null : '#000');
    },

    pathRoundedShape: function(context) {
      var r = Math.min(this.height, this.width)/2;
      var w = this.width;
      var h = this.height;

      context.moveTo(0, r);
      context.arc(r, r, r, PI, PI32, false);
      context.arc(w - r, r, r, PI32, 0, false);
      context.arc(w - r, h - r, r, 0, PI12, false);
      context.arc(r, h - r, r, PI12, PI, false);
    },

    pathRectShape: function(context) {
      var w = this.width;
      var h = this.height;

      context.moveTo(0, 0);
      context.lineTo(w, 0);
      context.lineTo(w, h);
      context.lineTo(0, h);
    },

    layoutSelf: function() {
      // var bb = this.el.getBoundingClientRect();
      // this.width = bb.width;
      // this.height = bb.height;

      switch (this._type) {
        case 's':
        case 'n':
        case 'd':
          this.width = Math.max(4, measureArg(this.field.value)) + 9;
          this.field.style.width = this.width + 'px';
          this.height = 15;
          break;
        default:
          this.width = 13;
          this.height = 13;
          break;
      }

      this.el.style.width = this.width+'px';
      this.el.style.height = this.height+'px';

      this.draw();
    },

    layoutChildren: function() {
      this.layoutSelf();
    },

    layout: function() {
      if (!this.parent) return;

      this.layoutSelf();
      this.parent.layout();
    }
  };

  var measureArg = function() {
    var field = el('Visual-field Visual-field-measure');
    var node = document.createTextNode('');
    field.appendChild(node);
    document.body.appendChild(field);

    var hasOwnProperty = Object.prototype.hasOwnProperty;
    var stringCache = Object.create(null);

    return function measureArg(text) {
      if (hasOwnProperty.call(stringCache, text)) {
        return stringCache[text];
      }
      node.data = text;
      return stringCache[text] = field.offsetWidth;
    };
  }();


  function Script() {
    this.el = el('Visual-script');

    this.blocks = [];
    this.absolute = false;
  }

  Script.prototype = {
    constructor: Script,

    isArg: false,
    isBlock: false,
    isScript: true,
    isWorkspace: false,

    parent: null,

    get workspace() {return this.parent && this.parent.workspace},

    add: function(block) {
      block.parent = this;
      this.blocks.push(block);
      this.el.appendChild(block.el);

      block.layoutChildren();
      this.layout();

      return this;
    },

    layoutChildren: function() {
      this.blocks.forEach(function(b) {
        b.layoutChildren();
      });
    },

    layout: function() {
      if (this.parent) this.parent.layout();
    },

    _layout: function() {},

    get absolute() {return this._absolute},
    set absolute(value) {
      this._absolute = value;

      this.el.className = value ? 'Visual-script Visual-absolute-script' : 'Visual-script';
    },

    moveTo: function(x, y) {
      this.absolute = true;
      this.x = x;
      this.y = y;
      setTransform(this.el, 'translate('+x+'px,'+y+'px)');
    }
  };


  function Workspace(el) {
    this.el = el;
    this.el.className += ' Visual-workspace';

    if (el.tagName === 'BODY' && el.parentNode) {
      el.parentNode.style.height = '100%';
    }

    this.scripts = [];
  }

  Workspace.prototype = {
    constructor: Workspace,

    isArg: false,
    isBlock: false,
    isScript: false,
    isWorkspace: true,

    parent: null,

    get workspace() {return this},

    add: function(x, y, script) {
      script.parent = this;
      this.scripts.push(script);

      script.moveTo(x, y);
      this.el.appendChild(script.el);

      script.layoutChildren();

      return this;
    },

    layout: function() {}
  };


  return {
    Block: Block,
    Script: Script,
    Workspace: Workspace
  };
}
