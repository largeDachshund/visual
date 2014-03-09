function Visual(options) {
  'use strict';

  var def = Object.defineProperty;


  if (!options.getBlock) {
    options.getBlock = function(name) {
      var b = options.blocks[name];
      return b.slice(0, 2).concat(name, b.slice(2));
    };
  }
  if (!options.getCategory) {
    options.getCategory = function(name) {
      return [name].concat(options.categories[name]);
    };
  }


  function el(tagName, className) {
    var d = document.createElement(className ? tagName : 'div');
    d.className = className || tagName || '';
    return d;
  }

  function layout() {
    if (!this.parent) return;

    this.layoutSelf();
    this.parent.layout();
  }

  function layoutNoChildren() {
    this.layoutSelf();
  }

  function randColor() {
    var s = (Math.random() * 0x1000000 | 0).toString(16);
    return '#'+'000000'.slice(s.length)+s;
  }

  function setTransform(el, transform) {
    el.style.WebkitTransform =
    el.style.MozTransform =
    el.style.MSTransform =
    el.style.OTransform =
    el.style.transform = transform;
  }

  function bezel(context, path, thisArg, inset, alpha) {
    var s = inset ? -1 : 1;
    var w = context.canvas.width;
    var h = context.canvas.height;

    context.beginPath();
    path.call(thisArg, context);
    context.fill();

    context.save();
    context.translate(-10000, -10000);
    context.beginPath();
    context.moveTo(-3, -3);
    context.lineTo(-3, h+3);
    context.lineTo(w+3, h+3);
    context.lineTo(w+3, -3);
    context.closePath();
    path.call(thisArg, context);

    if (alpha) context.fillStyle = '#000';
    context.globalCompositeOperation = 'source-atop';

    context.shadowOffsetX = 10000 + s * -1;
    context.shadowOffsetY = 10000 + s * -1;
    context.shadowBlur = 1;
    context.shadowColor = 'rgba(0, 0, 0, .4)';
    context.fill();

    context.shadowOffsetX = 10000 + s * 1;
    context.shadowOffsetY = 10000 + s * 1;
    context.shadowBlur = 1;
    context.shadowColor = 'rgba(255, 255, 255, .4)';
    context.fill();

    context.restore();
  }


  function Block(info, args) {
    this.el = el('Visual-block');
    this.el.appendChild(this.canvas = el('canvas', 'Visual-canvas'));
    this.context = this.canvas.getContext('2d');

    if (typeof info === 'string') info = options.getBlock(info);

    if (!args) args = [];
    this.args = args.concat(info.slice(4 + args.length));

    var category = info[3];
    if (typeof category === 'string') category = options.getCategory(category);

    this.type = info[0];
    this.spec = info[1];
    this.name = info[2];
    this.color = category[2];
  }

  var PI12 = Math.PI * 1/2;
  var PI = Math.PI;
  var PI32 = Math.PI * 3/2;

  Block.prototype = {
    constructor: Block,

    blockClasses: {
      c: 'Visual-command Visual-puzzled Visual-block',
      f: 'Visual-command Visual-block',
      r: 'Visual-part Visual-block Visual-reporter',
      b: 'Visual-part Visual-block Visual-reporter Visual-boolean-reporter'
    },

    isArg: false,
    isBlock: true,
    isScript: false,
    isWorkspace: false,

    parent: null,

    radius: 4,
    puzzle: 3,
    puzzleWidth: 9,
    puzzleInset: 14,

    pathBlockType: {
      c: function(context) {
        this.pathCommandShape(true, context);
      },
      f: function(context) {
        this.pathCommandShape(false, context);
      },
      r: function(context) {
        var w = this.width;
        var h = this.height;
        var r = Math.min(w, h) / 2;

        context.moveTo(0, r);
        context.arc(r, r, r, PI, PI32, false);
        context.arc(w - r, r, r, PI32, 0, false);
        context.arc(w - r, h - r, r, 0, PI12, false);
        context.arc(r, h - r, r, PI12, PI, false);
      },
      b: function(context) {
        var w = this.width;
        var h = this.height;
        var r = Math.min(h, w) / 2;

        context.moveTo(0, r);
        context.lineTo(r, 0);
        context.lineTo(w - r, 0);
        context.lineTo(w, r);
        context.lineTo(w - r, h);
        context.lineTo(r, h);
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
        var text = parts[i].trim();
        if (text) {
          this.add(new Label(text));
        }
        i++;
        if (i >= parts.length) break;
        if (parts[i]) {
          this.add(new Icon(parts[i]))
        }
        i++;
        if (parts[i]) {
          var old = args[this.args.length];
          this.add(old && old.isBlock ? old : new Arg(parts[i], old));
        }
        i++;
      }
    },

    get type() {return this._type},
    set type(value) {
      this._type = value;

      this.el.className = this.blockClasses[value];
    },

    get color() {return this._color},
    set color(value) {
      this._color = value;

      if (this.parent) this.draw();
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

    layout: layout,

    layoutChildren: function() {
      this.parts.forEach(function(p) {
        p.layoutChildren();
      });
      this.layoutSelf();
    },

    layoutSelf: function() {
      this.width = this.el.offsetWidth;
      this.height = this.el.offsetHeight;

      this.draw();
    },

    pathBlock: function(context) {
      this.pathBlockType[this._type].call(this, context);
      var w = this.width;
      var r = this.radius;
      var p = this.puzzle;
      var pi = this.puzzleInset;
      var pw = this.puzzleWidth;
      this.args.forEach(function(a) {
        if (a._type === 't') {
          var x = a.el.offsetLeft;
          var y = a.el.offsetTop;
          var h = a.height;
          context.moveTo(x + r, y);
          context.arc(x + r, y + r, r, PI32, PI, true);
          context.arc(x + r, y + h - r, r, PI, PI12, true);
          context.arc(w - r, y + h + r, r, PI32, 0, false);
          context.arc(w - r, y - r, r, 0, PI12, false);
          context.lineTo(x + pi + pw + p * 2, y);
          context.lineTo(x + pi + pw + p, y + p);
          context.lineTo(x + pi + p, y + p);
          context.lineTo(x + pi, y);
          context.closePath();
        }
      });
    },

    draw: function() {
      this.canvas.width = this.width;
      this.canvas.height = this.height;

      this.context.fillStyle = this._color;
      bezel(this.context, this.pathBlock, this);
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

    layoutSelf: function() {},
    layoutChildren: layoutNoChildren,
    layout: layout
  };


  function Icon(name) {
    this.el = el('Visual-part');
    this.name = name;
  }

  Icon.prototype = {
    constructor: Icon,

    isArg: false,
    isBlock: false,
    isScript: false,
    isWorkspace: false,

    parent: null,

    get name() {return this._name},
    set name(value) {
      this.el.className = 'Visual-part Visual-icon-' + value;
      this._name = value;
    },

    get workspace() {return this.parent && this.parent.workspace},

    layoutSelf: function() {
      if (this.name) {
        this.el.appendChild(this.canvas = el('canvas', 'Visual-canvas'));
        this.canvas.width = 14;
        this.canvas.height = 11;

        var context = this.canvas.getContext('2d');
        this.pathLoopArrow(context);
        context.fillStyle = 'rgba(0, 0, 0, .3)';
        context.fill();

        context.translate(-1, -1);
        this.pathLoopArrow(context);
        context.fillStyle = 'rgba(255, 255, 255, .9)';
        context.fill();

      } else if (this.canvas) {
        this.el.removeChild(this.canvas);
        this.canvas = undefined;
      }
    },
    layoutChildren: layoutNoChildren,
    layout: layout,

    pathLoopArrow: function(context) {
      // m 1,11 8,0 2,-2 0,-3 3,0 -4,-5 -4,5 3,0 0,3 -8,0 z
      context.beginPath();
      context.moveTo(1, 11);
      context.lineTo(9, 11);
      context.lineTo(11, 9);
      context.lineTo(11, 6);
      context.lineTo(14, 6);
      context.lineTo(10, 1);
      context.lineTo(6, 6);
      context.lineTo(9, 6);
      context.lineTo(9, 9);
      context.lineTo(1, 9);
      context.lineTo(1, 11);
    }
  };


  function Arg(info, value) {
    this.el = el();
    this.el.appendChild(this.canvas = el('canvas', 'Visual-canvas'));
    this.context = this.canvas.getContext('2d');

    if (typeof info === 'string') info = info.split('.');
    this.type = info[0];
    this.menu = info[1];

    if (value != null) this.value = value;
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

    get value() {
      switch (this._type) {
        case 'c':
        case 'd':
        case 'n':
        case 's':
          return this.field.value;
        case 't':
          return this.script;
      }
    },
    set value(value) {
      switch (this._type) {
        case 'd':
        case 'n':
        case 'm':
        case 's':
        case 'c':
          this.field.value = value;
          return;
        case 't':
          if (value.isScript) {
            this.el.removeChild(this.script);
            this.script = value;
            this.el.appendChild(value.el);
          } else {
            value.forEach(function(v) {
              this.script.add(v);
            }, this);
          }
      }
    },

    get type() {return this._type},
    set type(value) {
      this._type = value;

      this.el.className = this.argClasses[value];

      if (this.field) this.el.removeChild(this.field);
      if (this.script) {
        this.el.removeChild(this.script);
        this.el.appendChild(this.canvas);
      }

      switch (value) {
        case 'c':
          this.field = el('input', 'Visual-field Visual-color-field');
          this.field.type = 'color';
          this.field.value = randColor();
          this.field.addEventListener('input', this.draw.bind(this));
          break;
        case 'd':
        case 'n':
        case 's':
          this.field = el('input', 'Visual-field Visual-text-field');
          this.field.addEventListener('input', this.layout.bind(this));
          break;
        case 't':
          this.script = new Script();
          this.script.parent = this;
          this.el.appendChild(this.script.el);
          break;
      }
      if (this.field) this.el.appendChild(this.field);

      this.layout();
    },

    get workspace() {return this.parent && this.parent.workspace},

    draw: function() {
      this.canvas.width = this.width;
      this.canvas.height = this.height;

      if (this._type === 't') return;

      var field = 'bcm'.indexOf(this._type) === -1;

      this.context.fillStyle =
        field ? '#fff' :
        this._type === 'c' ? this.field.value : 'rgba(0, 0, 0, .2)';
      bezel(this.context, this[this.pathArgType[this._type]], this, true, !field);
    },

    pathRoundedShape: function(context) {
      var w = this.width;
      var h = this.height;
      var r = Math.min(w, h) / 2;

      context.moveTo(0, r);
      context.arc(r, r, r, PI, PI32, false);
      context.arc(w - r, r, r, PI32, 0, false);
      context.arc(w - r, h - r, r, 0, PI12, false);
      context.arc(r, h - r, r, PI12, PI, false);
    },

    pathRectShape: function(context) {
      var w = this.width;
      var h = this.height;

      context.moveTo(0, .5);
      context.lineTo(w, .5);
      context.lineTo(w, h-.5);
      context.lineTo(0, h-.5);
    },

    pathBooleanShape: function(context) {
      var w = this.width;
      var h = this.height;
      var r = Math.min(w, h) / 2;

      context.moveTo(0, r);
      context.lineTo(r, 0);
      context.lineTo(w - r, 0);
      context.lineTo(w, r);
      context.lineTo(w - r, h);
      context.lineTo(r, h);
    },

    layoutSelf: function() {
      switch (this._type) {
        case 's':
        case 'n':
        case 'd':
          this.width = Math.max(6, measureArg(this.field.value)) + 9;
          this.height = this.field.offsetHeight;
          this.field.style.width = this.width + 'px';
          break;
        case 't':
          this.width = 0;
          this.height = Math.max(10, this.script.el.offsetHeight);
          break;
        case 'b':
          this.width = 27;
          this.height = 13;
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

    layoutChildren: layoutNoChildren,
    layout: layout
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
      return stringCache[text] = field.offsetWidth + 1;
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

      if (this.parent) block.layoutChildren();
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


  function Workspace(host) {
    this.el = host;
    this.el.className += ' Visual-workspace';

    this.el.appendChild(this.fill = el('Visual-fill'));
    this.el.addEventListener('scroll', this.layout.bind(this));

    if (host.tagName === 'BODY' && host.parentNode) {
      host.parentNode.style.height = '100%';
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

    layout: function() {

    }
  };


  return {
    Block: Block,
    Script: Script,
    Workspace: Workspace
  };
}
