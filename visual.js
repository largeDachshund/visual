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

  function getWorkspacePosition(o) {
    var ws = o.workspace.el;
    var wb = ws.getBoundingClientRect();
    var ob = o.el.getBoundingClientRect();
    return {
      x: ob.left - wb.left | 0,
      y: ob.top - wb.top | 0
    };
  }

  function containsPoint(extent, x, y) {
    return x >= 0 && y >= 0 && x < extent.width && y < extent.height;
  }

  function transparentAt(context, x, y) {
    return containsPoint(context.canvas, x, y) && context.getImageData(x, y, 1, 1).data[3] > 0;
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
    this.defaultArgs = info.slice(4);
    this.args = args.concat(this.defaultArgs.slice(args.length));

    var category = info[3];
    if (typeof category === 'string') category = options.getCategory(category);

    this.name = info[2];
    this.type = info[0];
    this.spec = info[1];
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
      this.inputs = [];
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
          var arg = new Arg(parts[i], old && old.isBlock ? this.defaultArgs[this.args.length] : old);
          this.inputs.push(arg);
          this.add(old && old.isBlock ? old : arg);
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
    get workspacePosition() {return getWorkspacePosition(this)},

    get dragObject() {return this},

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

    replace: function(oldPart, newPart) {
      if (oldPart.parent !== this) return this;

      oldPart.parent = null;
      newPart.parent = this;

      var i = this.parts.indexOf(oldPart);
      this.parts.splice(i, 1, newPart);

      var array = oldPart.isArg || oldPart.isBlock ? this.args : this.labels;
      i = array.indexOf(oldPart);
      array.splice(i, 1, newPart);

      this.el.replaceChild(newPart.el, oldPart.el);

      if (this.parent) newPart.layoutChildren();
      this.layout();

      return this;
    },

    remove: function(part) {
      if (part.parent !== this) return this;

      part.parent = null;
      var i = this.parts.indexOf(part);
      this.parts.splice(i, 1);

      var array = part.isArg ? this.args : this.labels;
      i = array.indexOf(part);
      array.splice(i, 1);

      this.el.removeChild(part.el);

      return this;
    },

    reset: function(arg) {
      if (arg.parent !== this || !arg.isArg && !arg.isBlock) return this;

      var i = this.args.indexOf(arg);
      this.replace(arg, this.inputs[i]);

      return this;
    },

    detach: function() {
      if (this.parent.isBlock) {
        this.parent.reset(this);
        return new Script().add(this);
      }
      if (this.parent.isScript) {
        return this.parent.splitAt(this);
      }
    },

    objectFromPoint: function(x, y) {
      var args = this.args;
      for (var i = args.length; i--;) {
        var arg = args[i];
        var o = arg.objectFromPoint(x - arg.el.offsetLeft, y - arg.el.offsetTop);
        if (o) return o;
      }
      return transparentAt(this.context, x, y) ? this : null;
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

      this.drawOn(this.context);
    },

    drawOn: function (context) {
      context.fillStyle = this._color;
      bezel(context, this.pathBlock, this);
    },

    pathShadowOn: function(context) {
      this.pathBlock(context);
      this.args.forEach(function(a) {
        if (a._type === 't') {
          context.save();
          context.translate(a.el.offsetLeft, a.el.offsetTop);
          a.script.pathShadowOn(context);
          context.restore();
        }
      });
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
    get workspacePosition() {return getWorkspacePosition(this)},

    get dragObject() {return this.parent.dragObject},

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
    get workspacePosition() {return getWorkspacePosition(this)},

    get dragObject() {return this.parent.dragObject},

    layoutSelf: function() {
      if (this.canvas) {
        this.el.removeChild(this.canvas);
        this.canvas = undefined;
      }
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
            this.script.parent = null;
            this.script = value;
            value.parent = this;
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
    get workspacePosition() {return getWorkspacePosition(this)},

    get dragObject() {return this.parent.dragObject},

    objectFromPoint: function(x, y) {
      switch (this._type) {
        case 'b': return null;
        case 't': return this.script.objectFromPoint(x, y);
      }
      return transparentAt(this.context, x, y) ? this : null;
    },

    draw: function() {
      this.canvas.width = this.width;
      this.canvas.height = this.height;

      this.drawOn(this.context);
    },

    drawOn: function(context) {
      if (this._type === 't') return;

      var field = 'bcm'.indexOf(this._type) === -1;

      context.fillStyle =
        field ? '#fff' :
        this._type === 'c' ? this.field.value : 'rgba(0, 0, 0, .2)';
      bezel(context, this[this.pathArgType[this._type]], this, true, !field);
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
          this.height = Math.max(10, this.script.height);
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
    this.x = 0;
    this.y = 0;
    this.width = 0;
    this.height = 0;
  }

  Script.prototype = {
    constructor: Script,

    isArg: false,
    isBlock: false,
    isScript: true,
    isWorkspace: false,

    parent: null,

    get workspace() {return this.parent && this.parent.workspace},
    get workspacePosition() {return getWorkspacePosition(this)},

    shadow: function(blur, color) {
      var canvas = el('canvas', 'Visual-canvas');
      canvas.width = this.width + blur * 2;
      canvas.height = this.height + blur * 2;

      var context = canvas.getContext('2d');
      context.fillStyle = '#000';
      context.shadowColor = color;
      context.shadowBlur = blur;
      context.shadowOffsetX = 10000 + blur;
      context.shadowOffsetY = 10000 + blur;
      context.translate(-10000, -10000);
      this.pathShadowOn(context);
      context.fill();

      return canvas;
    },

    addShadow: function(offsetX, offsetY, blur, color) {
      this.removeShadow();

      var canvas = this.shadow(blur, color);
      setTransform(canvas, 'translate(' + (offsetX - blur) + 'px, ' + (offsetY - blur) + 'px)');
      this._shadow = canvas;
      this.el.insertBefore(canvas, this.el.firstChild);

      return this;
    },

    removeShadow: function() {
      if (this._shadow) {
        this.el.removeChild(this._shadow);
        this._shadow = null;
      }
      return this;
    },

    pathShadowOn: function(context) {
      context.save();
      var blocks = this.blocks;
      var length = blocks.length;
      var y = 0;
      for (var i = 0; i < length; i++) {
        var b = blocks[i];
        var ny = b.el.offsetTop;
        context.translate(0, ny - y);
        b.pathShadowOn(context);
        y = ny;
      }
      context.restore();
    },

    splitAt: function(topBlock) {
      var script = new Script();
      if (topBlock.parent !== this) return script;

      var blocks = this.blocks;
      var i = blocks.indexOf(topBlock);

      while (i < blocks.length) {
        script.add(blocks[i]);
      }

      this.layout();
      return script;
    },

    add: function(block) {
      if (block.parent) block.parent.remove(block);

      block.parent = this;
      this.blocks.push(block);
      this.el.appendChild(block.el);

      if (this.parent) block.layoutChildren();
      this.layout();

      return this;
    },

    replace: function(oldBlock, newBlock) {
      if (oldBlock.parent !== this) return this;

      oldBlock.parent = null;
      newBlock.parent = this;

      var i = this.blocks.indexOf(oldBlock);
      this.blocks.splice(i, 1, newBlock);
      this.el.replaceChild(newBlock.el, oldBlock.el);

      if (this.parent) newBlock.layoutChildren();
      this.layout();

      return this;
    },

    remove: function(block) {
      if (block.parent !== this) return this;

      block.parent = null;
      var i = this.blocks.indexOf(block);
      this.blocks.splice(i, 1);
      this.el.removeChild(block.el);

      return this;
    },

    objectFromPoint: function(x, y) {
      if (!containsPoint(this, x, y)) return null;
      var blocks = this.blocks;
      for (var i = blocks.length; i--;) {
        var block = blocks[i];
        var o = block.objectFromPoint(x, y - block.el.offsetTop);
        if (o) return o;
      }
      return null;
    },

    layoutChildren: function() {
      this.blocks.forEach(function(b) {
        b.layoutChildren();
      });
      this.layoutSelf();
    },

    layout: layout,

    layoutSelf: function() {
      this.width = this.el.offsetWidth;
      this.height = this.el.offsetHeight;
    },

    moveTo: function(x, y) {
      this.x = x;
      this.y = y;
      setTransform(this.el, 'translate('+x+'px,'+y+'px)');
    }
  };


  function Workspace(host) {
    this.el = host;
    this.el.className += ' Visual-workspace';

    this.el.appendChild(this.fill = el('Visual-fill'));
    this.el.addEventListener('mousedown', this.press.bind(this));
    document.addEventListener('mousemove', this.drag.bind(this));
    document.addEventListener('mouseup', this.drop.bind(this));

    this.scripts = [];

    if (host.tagName === 'BODY' && host.parentNode) {
      host.parentNode.style.height = '100%';
      window.addEventListener('resize', this.layout.bind(this));
      window.addEventListener('scroll', this.scroll.bind(this));
      this.layout();
    } else {
      this.el.addEventListener('scroll', this.scroll.bind(this));
    }
  }

  Workspace.prototype = {
    constructor: Workspace,

    isArg: false,
    isBlock: false,
    isScript: false,
    isWorkspace: true,

    parent: null,

    padding: 20,
    extraSpace: 100,

    get workspace() {return this},
    get workspacePosition() {return {x: 0, y: 0}},

    add: function(x, y, script) {
      script.parent = this;
      this.scripts.push(script);

      script.moveTo(x, y);
      this.el.appendChild(script.el);

      script.layoutChildren();
      this.layout();

      return this;
    },

    objectFromPoint: function(x, y) {
      var scripts = this.scripts;
      for (var i = scripts.length; i--;) {
        var script = scripts[i];
        var o = script.objectFromPoint(x - script.x, y - script.y);
        if (o) return o;
      }
      return null;
    },

    press: function(e) {
      this.updateMouse(e);
      this.pressX = this.mouseX;
      this.pressY = this.mouseY;
      this.pressObject = this.objectFromPoint(this.pressX, this.pressY);
      this.shouldDrag = this.pressObject && !(this.pressObject.isArg && this.pressObject.field && document.activeElement === this.pressObject.field);
      this.pressed = true;
      this.dragging = false;
    },

    drag: function(e) {
      this.updateMouse(e);

      if (this.dragging) {
        this.dragScript.moveTo(this.dragX + this.mouseX, this.dragY + this.mouseY);
        e.preventDefault();
      } else if (this.pressed && this.shouldDrag) {
        this.dragging = true;
        this.dragObject = this.pressObject.dragObject;

        var pos = this.dragObject.workspacePosition;
        this.dragX = pos.x - this.pressX;
        this.dragY = pos.y - this.pressY;

        this.dragScript = this.dragObject.detach();
        this.add(this.dragX + this.mouseX, this.dragY + this.mouseY, this.dragScript);
        this.dragScript.addShadow(6, 6, 8, 'rgba(0, 0, 0, .3)');
        e.preventDefault();
      }
    },

    drop: function(e) {
      this.updateMouse(e);
      if (this.dragging) {
        this.dragScript.removeShadow();
      } else if (this.shouldDrag) {
        if (this.pressObject.isArg) {
          if (this.pressObject.field) {
            this.pressObject.field.select();
          }
        }
      }
      this.dragging = false;
      this.pressed = false;
    },

    updateMouse: function(e) {
      var bb = this.el.getBoundingClientRect();
      this.mouseX = e.clientX - bb.left;
      this.mouseY = e.clientY - bb.top;
    },

    scroll: function() {
      this.refill();
    },

    layout: function() {
      var p = this.padding;
      var x = p;
      var y = p;
      var width = 0;
      var height = 0;
      this.scripts.forEach(function(script) {
        x = Math.min(x, script.x);
        y = Math.min(y, script.y);
        width = Math.max(width, script.x - x + script.width);
        height = Math.max(height, script.y - y + script.height);
      });

      if (x < p || y < p) {
        x -= p;
        y -= p;
        this.scripts.forEach(function(script) {
          script.moveTo(script.x - x, script.y - y);
        });
        width -= x;
        height -= y;
      } else {
        width += x;
        height += y;
      }

      width += this.extraSpace;
      height += this.extraSpace;

      this.width = width;
      this.height = height;

      this.refill();
    },

    refill: function() {
      var vw = this.el.offsetWidth + this.el.scrollLeft + this.extraSpace;
      var vh = this.el.offsetHeight + this.el.scrollTop + this.extraSpace;

      this.fill.style.width = Math.max(this.width, vw) + 'px';
      this.fill.style.height = Math.max(this.height, vh) + 'px';
    }
  };


  return {
    Block: Block,
    Script: Script,
    Workspace: Workspace
  };
}
