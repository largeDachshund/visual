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

  function ignoreEvent(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function layout() {
    if (!this.parent) return;

    this.layoutSelf();
    this.parent.layout();
  }

  function layoutNoChildren() {
    if (this.dirty) {
      this.dirty = false;
      this.layoutSelf();
    }
  }

  function moveTo(x, y) {
    if (this.x === x && this.y === y) return;
    this.x = x;
    this.y = y;
    setTransform(this.el, 'translate('+x+'px,'+y+'px)');
  }

  function getWorkspacePosition(o) {
    var x = 0;
    var y = 0;
    while (o && !o.isWorkspace) {
      x += o.x;
      y += o.y;
      o = o.parent;
    }
    return {x: x, y: y};
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
    el.style.msTransform =
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
    // context.clip();

    context.save();
    context.translate(-10000, -10000);
    context.beginPath();
    context.moveTo(-3, -3);
    context.lineTo(-3, h+3);
    context.lineTo(w+3, h+3);
    context.lineTo(w+3, -3);
    context.closePath();
    path.call(thisArg, context);

    // if (alpha) context.fillStyle = '#000';
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

  function metrics(className) {
    var field = el('Visual-metrics ' + className);
    var node = document.createTextNode('');
    field.appendChild(node);
    document.body.appendChild(field);

    var hasOwnProperty = Object.prototype.hasOwnProperty;
    var stringCache = Object.create(null);

    return function measure(text) {
      if (hasOwnProperty.call(stringCache, text)) {
        return stringCache[text];
      }
      node.data = text + '\u200C';
      return stringCache[text] = {
        width: field.offsetWidth,
        height: field.offsetHeight
      };
    };
  }


  function Block(info, args) {
    this.el = el('Visual-absolute');
    this.el.appendChild(this.canvas = el('canvas', 'Visual-absolute'));
    this.context = this.canvas.getContext('2d');

    if (typeof info === 'string') info = options.getBlock(info);

    if (!args) args = [];
    this.defaultArgs = info.slice(4);
    this.args = args.concat(this.defaultArgs.slice(args.length));

    var category = info[3];
    if (typeof category === 'string') category = options.getCategory(category);

    this.name = info[2];
    this.type = info[0];
    this.isHat = this.type === 'h';
    this.hasPuzzle = this.type === 'c' || this.type === 'h';
    this.isFinal = this.type === 'f';
    this.isReporter = this.type === 'r' || this.type === 'b';
    this.isBoolean = this.type === 'b';
    this.spec = info[1];
    this.color = category[2];
  }

  var PI12 = Math.PI * 1/2;
  var PI = Math.PI;
  var PI32 = Math.PI * 3/2;

  Block.prototype = {
    constructor: Block,

    isArg: false,
    isBlock: true,
    isIcon: false,
    isScript: false,
    isWorkspace: false,

    parent: null,
    dirty: true,

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
        var w = this.ownWidth;
        var h = this.ownHeight;
        var r = Math.min(w, (this.hasScript ? 15 : h)) / 2;

        context.moveTo(0, r);
        context.arc(r, r, r, PI, PI32, false);
        context.arc(w - r, r, r, PI32, 0, false);
        context.arc(w - r, h - r, r, 0, PI12, false);
        context.arc(r, h - r, r, PI12, PI, false);
      },
      b: function(context) {
        var w = this.ownWidth;
        var h = this.ownHeight;
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
      var w = this.ownWidth;
      var h = this.ownHeight - bottom * p;
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
      this.hasScript = false;

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
          var arg = old && old.isArg ? old : new Arg(parts[i], old && old.isBlock ? this.defaultArgs[this.args.length] : old);
          this.inputs.push(arg);
          this.add(old && old.isBlock ? old : arg);
          if (arg._type === 't') {
            this.hasScript = true;
          }
        }
        i++;
      }
    },

    get color() {return this._color},
    set color(value) {
      this._color = value;

      if (this.parent) this.draw();
    },

    get workspace() {return this.parent && this.parent.workspace},
    get workspacePosition() {return getWorkspacePosition(this)},

    get contextMenu() {
      var workspace = this.workspace;
      var pressX = workspace.pressX;
      var pressY = workspace.pressY;
      return new Menu(
        ['Duplicate', function() {
          var pos = this.workspacePosition;
          workspace.grab(this.scriptCopy(), pos.x - pressX, pos.y - pressY);
        }],
        Menu.line,
        'Help',
        'Add Comment',
        Menu.line,
        ['Delete', this.destroy]).withContext(this);
    },

    get dragObject() {return this},

    acceptsDropOf: function(b) {
      if (!this.parent || !this.parent.isBlock) return;
      var args = this.parent.args;
      var i = args.indexOf(this);
      var def = this.parent.inputs[i];
      return def && def.acceptsDropOf(b);
    },

    add: function(part) {
      if (part.parent) part.parent.remove(part);

      part.parent = this;
      this.parts.push(part);

      if (part.isBlock || part.isArg) {
        this.args.push(part);
      } else {
        this.labels.push(part);
      }

      if (this.parent) part.layoutChildren();
      this.layout();

      this.el.appendChild(part.el);

      return this;
    },

    replace: function(oldPart, newPart) {
      if (oldPart.parent !== this) return this;
      if (newPart.parent) newPart.parent.remove(newPart);

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

    destroy: function() {
      if (!this.parent) return this;
      if (this.parent.isScript) {
        this.parent.remove(this);
      } else if (this.parent.isBlock) {
        this.parent.reset(this);
      }
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

    copy: function() {
      var args = this.args.map(function(a) {return a.copy()});
      return new Block(this.name, args);
    },

    scriptCopy: function() {
      if (!this.parent || !this.parent.isScript) return new Script().add(this.copy());
      return this.parent.copyAt(this);
    },

    objectFromPoint: function(x, y) {
      var args = this.args;
      for (var i = args.length; i--;) {
        var arg = args[i];
        var o = arg.objectFromPoint(x - arg.x, y - arg.y);
        if (o) return o;
      }
      return transparentAt(this.context, x, y) ? this : null;
    },

    moveTo: moveTo,
    layout: layout,

    layoutChildren: function() {
      this.parts.forEach(function(p) {
        p.layoutChildren();
      });
      if (this.dirty) {
        this.dirty = false;
        this.layoutSelf();
      }
    },

    paddingX: 5,
    paddingY: 3,
    partPadding: 4,
    linePadding: 4,
    scriptPadding: 15,

    minDistance: function(part) {
      if (this.isBoolean) {
        return (
          part.isBlock && part.type === 'r' && !part.hasScript ? this.paddingX + part.height/4 | 0 :
          part.type !== 'b' ? this.paddingX + part.height/2 | 0 :
          0);
      }
      if (this.isReporter) {
        return (
          part.isArg && (part._type === 'd' || part._type === 'n') || part.isReporter && !part.hasScript ? 0 :
          (part.height)/2 | 0);
      }
      return 0;
    },

    layoutSelf: function() {
      var xp = this.paddingX;
      var yp = this.paddingY;
      var pp = this.partPadding;
      var lp = this.linePadding;
      var sp = this.scriptPadding;
      var cmw = this.puzzle * 2 + this.puzzleInset + this.puzzleWidth;
      var command = this.type === 'c';

      var lines = [[]];
      var lineXs = [[0]];
      var lineHeights = [0];
      var loop = null;

      var line = 0;
      var width = 0;
      var lineX = 0;
      var scriptWidth = 0;

      var parts = this.parts;
      var length = parts.length;
      for (var i = 0; i < length; i++) {
        var part = parts[i];
        if (part.isIcon && part.name === 'loop') {
          loop = part;
          continue;
        }
        if (part.isArg && part._type === 't') {
          lines.push([part], []);
          lineXs.push([0], []);
          lineHeights.push(part.height, 0);
          lineX = 0;
          scriptWidth = Math.max(scriptWidth, sp + part.script.width);
          line += 2;
        } else {
          var md = command ? 0 : this.minDistance(part);
          var mw = command ? (part.isBlock || part.isArg ? cmw : 0) : md;
          if (mw && !line && lineX < mw - xp) lineX = lineXs[line][lineXs[line].length-1] = mw - xp;
          lineX += part.width;
          width = Math.max(width, lineX + Math.max(0, md - xp));
          lineX += pp;
          lineXs[line].push(lineX);
          lineHeights[line] = Math.max(lineHeights[line], part.height);
          lines[line].push(part);
        }
      }

      if (!lines[line].length) {
        lineHeights[line] = 8;
      }
      width += xp * 2;

      var y = yp;
      length = lines.length;
      for (i = 0; i < length; i++) {
        var line = lines[i];
        var lh = lineHeights[i];
        var xs = lineXs[i];
        if (line[0] && line[0]._type === 't') {
          line[0].moveTo(sp, y);
        } else {
          for (var j = 0, l = line.length; j < l; j++) {
            var p = line[j];
            p.moveTo(xp + xs[j], y + ((lh - p.height) / 2 | 0));
          }
        }
        y += lh + lp;
      }
      var height = y - lp + yp;

      if (loop) {
        loop.moveTo(width - loop.width - 2, height - loop.height - 3);
      }

      this.ownWidth = width;
      this.ownHeight = height + (this.hasPuzzle ? this.puzzle : 0);
      this.width = Math.max(width, scriptWidth);
      this.height = height;

      this.draw();
    },

    pathBlock: function(context) {
      this.pathBlockType[this.type].call(this, context);
      context.closePath();
      var w = this.ownWidth;
      var r = this.radius;
      var p = this.puzzle;
      var pi = this.puzzleInset;
      var pw = this.puzzleWidth;
      this.args.forEach(function(a) {
        if (a._type === 't') {
          var x = a.x;
          var y = a.y;
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
      this.canvas.width = this.ownWidth;
      this.canvas.height = this.ownHeight;

      this.drawOn(this.context);
    },

    drawOn: function(context) {
      context.fillStyle = this._color;
      bezel(context, this.pathBlock, this);
    },

    pathShadowOn: function(context) {
      this.pathBlock(context);
      this.args.forEach(function(a) {
        if (a._type === 't') {
          context.save();
          context.translate(a.x, a.y);
          a.script.pathShadowOn(context);
          context.restore();
        }
      });
    }
  };


  function Label(text) {
    this.el = el('Visual-absolute Visual-label');

    this.text = text;
  }

  Label.measure = metrics('Visual-label');

  Label.prototype = {
    constructor: Label,

    isArg: false,
    isBlock: false,
    isIcon: false,
    isScript: false,
    isWorkspace: false,

    x: 0,
    y: 0,
    parent: null,
    dirty: false,

    get text() {return this._text},
    set text(value) {
      this.el.textContent = value;
      this._text = value;
      var metrics = Label.measure(value);
      this.width = metrics.width;
      this.height = metrics.height * 1.2 | 0;
    },

    get workspace() {return this.parent && this.parent.workspace},
    get workspacePosition() {return getWorkspacePosition(this)},

    get dragObject() {return this.parent.dragObject},

    layoutSelf: function() {},
    layoutChildren: layoutNoChildren,
    layout: layout,
    moveTo: moveTo
  };


  function Icon(name) {
    this.el = el('canvas', 'Visual-absolute');
    this.context = this.el.getContext('2d');
    this.name = name;
  }

  Icon.prototype = {
    constructor: Icon,

    isArg: false,
    isBlock: false,
    isIcon: true,
    isScript: false,
    isWorkspace: false,

    parent: null,
    dirty: true,

    get workspace() {return this.parent && this.parent.workspace},
    get workspacePosition() {return getWorkspacePosition(this)},

    get dragObject() {return this.parent.dragObject},

    layoutSelf: function() {
      var canvas = this.el;
      var context = this.context;
      if (this.name === 'loop') {
        canvas.width = 14;
        canvas.height = 11;

        this.pathLoopArrow(context);
        context.fillStyle = 'rgba(0, 0, 0, .3)';
        context.fill();

        context.translate(-1, -1);
        this.pathLoopArrow(context);
        context.fillStyle = 'rgba(255, 255, 255, .9)';
        context.fill();

      } else {
        canvas.width = 0;
        canvas.height = 0;
      }

      this.width = canvas.width;
      this.height = canvas.height;
    },
    layoutChildren: layoutNoChildren,
    layout: layout,
    moveTo: moveTo,

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
    this.el = el('Visual-absolute');
    this.el.appendChild(this.canvas = el('canvas', 'Visual-absolute'));
    this.context = this.canvas.getContext('2d');

    if (typeof info === 'string') info = info.split('.');
    this.type = info[0];
    this.menu = info[1];

    if (value != null) this.value = value;
  }

  Arg.measure = metrics('Visual-field');

  Arg.prototype = {
    constructor: Arg,

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
    isIcon: false,
    isScript: false,
    isWorkspace: false,

    parent: null,
    dirty: true,

    get value() {
      switch (this._type) {
        case 'c':
        case 'd':
        case 'n':
        case 's':
          return this.field.value;
        case 'm':
          return this._value;
        case 't':
          return this.script;
      }
    },
    set value(value) {
      switch (this._type) {
        case 'c':
        case 'd':
        case 'n':
        case 's':
          this.field.value = value;
          this.layout();
          return;
        case 'm':
          this.field.textContent = this._value = value;
          this.layout();
          return;
        case 't':
          if (value.isScript) {
            this.el.removeChild(this.script.el);
            this.script.parent = null;
            this.script = value;
            value.parent = this;
            this.el.appendChild(value.el);
            this.layout();
          } else {
            var script = new Script();
            value.forEach(function(v) {
              script.add(v);
            }, this);
            this.value = script;
          }
          return;
      }
    },

    get type() {return this._type},
    set type(value) {
      this._type = value;

      while (this.el.firstChild) {
        this.el.removeChild(this.el.lastChild);
      }
      this.isTextArg = false;

      var arrow;
      switch (value) {
        case 'c':
          this.field = el('input', 'Visual-absolute Visual-field Visual-color-field');
          this.field.type = 'color';
          this.field.value = randColor();
          this.field.addEventListener('input', this.draw.bind(this));
          break;
        case 'd':
          arrow = true;
          // fall through
        case 'n':
        case 's':
          this.field = el('input', 'Visual-absolute Visual-field Visual-text-field');
          this.field.addEventListener('input', this.layout.bind(this));
          this.isTextArg = true;
          break;
        case 'm':
          arrow = true;
          this.field = el('Visual-absolute Visual-field Visual-enum-field');
          break;
        case 't':
          this.script = new Script();
          this.script.parent = this;
          break;
      }
      if (this.script) {
        this.el.appendChild(this.script.el);
      } else {
        this.el.appendChild(this.canvas);
      }
      if (this.field) this.el.appendChild(this.field);
      if (arrow) {
        this.arrow = el('canvas', 'Visual-absolute');
        this.drawArrow();
        this.el.appendChild(this.arrow);
      }

      this.layout();
    },

    get workspace() {return this.parent && this.parent.workspace},
    get workspacePosition() {return getWorkspacePosition(this)},

    get contextMenu() {
      return this.parent.contextMenu;
    },

    get dragObject() {return this.parent.dragObject},

    acceptsDropOf: function(b) {
      return 'cmt'.indexOf(this.type) === -1 && (this.type !== 'b' || b.isBoolean);
    },

    copy: function() {
      var value = this.type === 't' ? this.script.copy() : this.value;
      return new Arg([this.type, this.menu], value);
    },

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
        this._type === 'c' ? this.field.value : this.color;
      bezel(context, this[this.pathArgType[this._type]], this, true, !field);
    },

    pathShadowOn: function(context) {
      if (this._type === 't') return;
      this[this.pathArgType[this._type]].call(this, context);
      context.closePath();
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

      context.moveTo(0, 0);
      context.lineTo(w, 0);
      context.lineTo(w, h);
      context.lineTo(0, h);
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

    drawArrow: function() {
      var w = 7;
      var h = 4;
      var canvas = this.arrow;
      canvas.width = w;
      canvas.height = h;
      var context = canvas.getContext('2d');
      context.fillStyle = 'rgba(0, 0, 0, .6)';
      context.moveTo(0, 0);
      context.lineTo(w, 0);
      context.lineTo(w/2, h);
      context.closePath();
      context.fill();
    },

    layoutSelf: function() {
      if (this._type === 'm' || this._type === 'b') {
        var can = document.createElement('canvas');
        can.width = 1;
        can.height = 1;
        var c = can.getContext('2d');
        c.fillStyle = this.parent.color;
        c.fillRect(0, 0, 1, 1);
        c.fillStyle = 'rgba(0, 0, 0, .2)';
        c.fillRect(0, 0, 1, 1);
        var d = c.getImageData(0, 0, 1, 1).data;
        var s = (d[0] * 0x10000 + d[1] * 0x100 + d[2]).toString(16);
        this.color = '#' + '000000'.slice(s.length) + s;
      }
      switch (this._type) {
        case 'd':
        case 'm':
        case 'n':
        case 's':
          var metrics = Arg.measure(this._type === 'm' ? this.field.textContent : this.field.value);
          this.width = Math.max(6, metrics.width) + 8 + (this.arrow ? this.arrow.width + 1 : 0);
          this.height = metrics.height + 2;
          this.field.style.width = this.width + 'px';
          this.field.style.height = this.height + 'px';
          if (this.arrow) {
            setTransform(this.arrow, 'translate('+(this.width - this.arrow.width - 3)+'px, '+((this.height - this.arrow.height) / 2 | 0)+'px)');
          }
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
          if (this.field) {
            this.field.style.width = this.width + 'px';
            this.field.style.height = this.height + 'px';
          }
          break;
      }

      this.draw();
    },

    layoutChildren: function() {
      if (this._type === 't') this.script.layoutChildren();
      if (this.dirty) {
        this.dirty = false;
        this.layoutSelf();
      }
    },
    layout: layout,
    moveTo: moveTo
  };


  function Script() {
    this.el = el('Visual-absolute Visual-script');

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
    isIcon: false,
    isScript: true,
    isWorkspace: false,

    parent: null,
    dirty: true,

    get workspace() {return this.parent && this.parent.workspace},
    get workspacePosition() {return getWorkspacePosition(this)},

    get hasHat() {return this.blocks.length && this.blocks[0].isHat},
    get hasFinal() {return this.blocks.length && this.blocks[this.blocks.length-1].isFinal},

    get isReporter() {return this.blocks.length && this.blocks[0].isReporter},

    shadow: function(blur, color) {
      var canvas = el('canvas', 'Visual-absolute');
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
      setTransform(canvas, 'translate('+(offsetX - blur)+'px, '+(offsetY - blur)+'px)');
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
        context.translate(0, b.y - y);
        b.pathShadowOn(context);
        y = b.y;
      }
      context.restore();
    },

    splitAt: function(topBlock) {
      var script = new Script();
      if (topBlock.parent !== this) return script;

      var blocks = this.blocks;
      var i = blocks.indexOf(topBlock);

      if (i === 0) {
        if (this.parent.isArg) this.parent.value = script;
        return this;
      }

      script.blocks = blocks.slice(i);
      this.blocks = blocks.slice(0, i);

      var f = document.createDocumentFragment();

      var length = blocks.length;
      for (;i < length; i++) {
        var b = blocks[i];
        b.parent = script;
        f.appendChild(b.el);
      }

      script.el.appendChild(f);

      this.layout();
      return script;
    },

    add: function(block) {
      if (block.parent) block.parent.remove(block);

      if (block.isScript) {
        this.addScript(block);
        return this;
      }

      block.parent = this;
      this.blocks.push(block);

      if (this.parent) block.layoutChildren();
      this.layout();

      this.el.appendChild(block.el);

      return this;
    },

    addScript: function(script) {
      var f = document.createDocumentFragment();

      var blocks = script.blocks;
      var length = blocks.length;
      for (var i = 0; i < length; i++) {
        var b = blocks[i];
        b.parent = this;
        f.appendChild(b.el);
      }

      this.blocks.push.apply(this.blocks, blocks);

      script.blocks = [];
      this.el.appendChild(f);

      for (var i = 0; i < length; i++) {
        blocks[i].layout();
      }

      this.layout();
    },

    insert: function(block, beforeBlock) {
      if (!beforeBlock || beforeBlock.parent !== this) return this.add(block);
      if (block.parent) block.parent.remove(block);

      if (block.isScript) {
        this.insertScript(block, beforeBlock);
        return this;
      }

      block.parent = this;
      var i = this.blocks.indexOf(beforeBlock);
      this.blocks.splice(i, 0, block);
      this.el.insertBefore(block.el, beforeBlock.el);


      if (this.parent) block.layoutChildren();
      this.layout();

      return this;
    },

    insertScript: function(script, beforeBlock) {
      var f = document.createDocumentFragment();

      var blocks = script.blocks;
      var length = blocks.length;
      for (var i = 0; i < length; i++) {
        var b = blocks[i];
        b.parent = this;
        f.appendChild(b.el);
      }

      var i = this.blocks.indexOf(beforeBlock);
      this.blocks.splice.apply(this.blocks, [i, 0].concat(blocks));

      script.blocks = [];
      this.el.insertBefore(f, beforeBlock.el);

      if (i === 0 && this.parent && this.parent.isWorkspace) {
        this.moveTo(this.x, this.y - script.height);
      }

      for (var i = 0; i < length; i++) {
        blocks[i].layout();
      }

      this.layout();
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

      this.layout();

      return this;
    },

    copy: function() {
      var script = new Script();
      script.addScript({blocks: this.blocks.map(function(b) {return b.copy()})});
      return script;
    },

    copyAt: function (b) {
      var script = new Script();
      var i = this.blocks.indexOf(b);
      if (i === -1) return script;
      script.addScript({blocks: this.blocks.slice(i).map(function(b) {return b.copy()})});
      return script;
    },

    objectFromPoint: function(x, y) {
      if (!containsPoint(this, x, y)) return null;
      var blocks = this.blocks;
      for (var i = blocks.length; i--;) {
        var block = blocks[i];
        var o = block.objectFromPoint(x, y - block.y);
        if (o) return o;
      }
      return null;
    },

    layoutChildren: function() {
      this.blocks.forEach(function(b) {
        b.layoutChildren();
      });
      if (this.dirty) {
        this.dirty = false;
        this.layoutSelf();
      }
    },

    layout: layout,

    layoutSelf: function() {
      var blocks = this.blocks;
      var length = blocks.length;
      var y = 0;
      var w = 0;
      for (var i = 0; i < length; i++) {
        var b = blocks[i];
        b.moveTo(0, y);
        w = Math.max(w, b.width);
        y += b.height;
      }

      this.width = w;
      this.height = y;
    },

    moveTo: moveTo
  };


  function Workspace(host) {
    this.el = host;
    this.el.className += ' Visual-workspace';

//     this.fill = el('Visual-absolute');
//     this.fillX.style.height = '1px';
//     this.el.appendChild(this.fillX);

//     this.fillY = el('Visual-absolute');
//     this.fillY.style.width = '1px';
//     this.el.appendChild(this.fillY);

    this.el.appendChild(this.fill = el('Visual-absolute'));

    this.el.addEventListener('mousedown', this.press.bind(this));
    this.el.addEventListener('contextmenu', this.blockContextMenu.bind(this));
    document.addEventListener('mousemove', this.drag.bind(this));
    document.addEventListener('mouseup', this.mouseUp.bind(this));

    this.feedback = el('canvas', 'Visual-absolute Visual-feedback');
    this.feedbackContext = this.feedback.getContext('2d');
    this.feedback.style.display = 'none';
    this.el.appendChild(this.feedback);

    this.scripts = [];

    if (host.tagName === 'BODY' && host.parentNode) {
      host.parentNode.style.height = '100%';
      window.addEventListener('resize', this.layout.bind(this));
      window.addEventListener('scroll', this.scroll.bind(this));
    } else {
      this.el.addEventListener('scroll', this.scroll.bind(this));
    }
    this.layout();
  }

  Workspace.prototype = {
    constructor: Workspace,

    isArg: false,
    isBlock: false,
    isIcon: false,
    isScript: false,
    isWorkspace: true,

    parent: null,

    padding: 20,
    extraSpace: 100,

    get workspace() {return this},
    get workspacePosition() {return {x: 0, y: 0}},

    add: function(x, y, script) {
      if (script.parent) script.parent.remove(script);

      script.parent = this;
      this.scripts.push(script);

      script.moveTo(x, y);
      script.layoutChildren();
      this.layout();

      this.el.appendChild(script.el);

      return this;
    },

    remove: function(script) {
      if (script.parent !== this) return this;
      script.parent = null;

      var i = this.scripts.indexOf(script);
      this.scripts.splice(i, 1);
      this.el.removeChild(script.el);

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

    get contextMenu() {
      return new Menu(
        'Clean Up',
        'Add Comment');
    },

    blockContextMenu: function(e) {
      var t = (e.target.nodeType === 1 ? e.target : e.target.parentNode).tagName;
      if (t !== 'INPUT' && t !== 'TEXTAREA' && t !== 'SELECT') e.preventDefault();
    },

    press: function(e) {
      this.drop();
      this.updateMouse(e);
      this.pressX = this.mouseX;
      this.pressY = this.mouseY;
      this.pressObject = this.objectFromPoint(this.pressX, this.pressY);

      this.shouldDrag = e.button === 0 && this.pressObject && !(this.pressObject.isTextArg && document.activeElement === this.pressObject.field);
      if (e.button === 2) {
        e.preventDefault();
        var cm = (this.pressObject || this).contextMenu;
        if (cm) cm.show(this);
      }
      this.pressed = true;
      this.dragging = false;
    },

    drag: function(e) {
      if (e) this.updateMouse(e);

      if (this.dragging) {
        this.dragScript.moveTo(this.dragX + this.mouseX, this.dragY + this.mouseY);
        this.updateFeedback();
        if (e) e.preventDefault();
      } else if (this.pressed && this.shouldDrag) {
        var block = this.pressObject.dragObject;
        var pos = block.workspacePosition;
        this.grab(block.detach(), pos.x - this.pressX, pos.y - this.pressY);
        e.preventDefault();
      }
    },

    grab: function(script, offsetX, offsetY) {
      if (this.dragging) {
        this.drop();
      }
      this.dragging = true;

      if (offsetX === undefined) {
        var pos = script.workspacePosition;
        offsetX = pos.x - this.pressX;
        offsetY = pos.y - this.pressY;
      }
      this.dragX = offsetX;
      this.dragY = offsetY;

      this.dragScript = script;
      this.dragScript.el.classList.add('Visual-script-dragging');
      this.add(this.dragX + this.mouseX, this.dragY + this.mouseY, this.dragScript);
      this.dragScript.addShadow(6, 6, 8, 'rgba(0, 0, 0, .3)');
      this.updateFeedback();
    },

    updateFeedback: function() {
      this.resetFeedback();
      if (this.dragScript.isReporter) {
        this.showReporterFeedback();
      } else {
        this.showCommandFeedback();
      }
      if (this.feedbackInfo) {
        this.renderFeedback(this.feedbackInfo);
        this.feedback.style.display = 'block';
      } else {
        this.feedback.style.display = 'none';
      }
    },

    resetFeedback: function() {
      this.feedbackDistance = Infinity;
      this.feedbackInfo = null;
    },

    commandFeedbackRange: 70,
    feedbackRange: 20,

    showCommandFeedback: function() {
      this.commandHasHat = this.dragScript.hasHat;
      this.commandHasFinal = this.dragScript.hasFinal;
      var scripts = this.scripts;
      var length = scripts.length;
      for (var i = 0; i < length; i++) {
        if (scripts[i] !== this.dragScript) {
          this.addScriptCommandFeedback(0, 0, scripts[i]);
        }
      }
    },

    addScriptCommandFeedback: function(x, y, script) {
      x += script.x;
      y += script.y;
      if (!script.hasFinal && !script.isReporter) {
        this.addFeedback({
          x: x,
          y: y + script.height,
          rangeX: this.commandFeedbackRange,
          rangeY: this.feedbackRange,
          type: 'append',
          script: script
        });
      }
      var blocks = script.blocks;
      var length = blocks.length;
      for (var i = 0; i < length; i++) {
        this.addBlockCommandFeedback(x, y, blocks[i], i === 0);
      }
    },

    addBlockCommandFeedback: function(x, y, block, isTop) {
      y += block.y;
      x += block.x;
      var args = block.args;
      var length = args.length;
      for (var i = 0; i < length; i++) {
        var a = args[i];
        if (a.isBlock) {
          this.addBlockCommandFeedback(x, y, a);
        } else if (a._type === 't') {
          this.addScriptCommandFeedback(x + a.x, y + a.y, a.script);
        }
      }
      if (isTop && block.isHat || !isTop && this.commandHasHat || this.commandHasFinal || block.isReporter) return;
      this.addFeedback({
        x: x,
        y: y,
        rangeX: this.commandFeedbackRange,
        rangeY: this.feedbackRange,
        type: 'insert',
        script: block.parent,
        block: block
      });
    },

    showReporterFeedback: function() {
      var scripts = this.scripts;
      var length = scripts.length;
      for (var i = 0; i < length; i++) {
        if (scripts[i] !== this.dragScript) {
          this.addScriptReporterFeedback(0, 0, scripts[i]);
        }
      }
    },

    addScriptReporterFeedback: function(x, y, script) {
      x += script.x;
      y += script.y;
      var blocks = script.blocks;
      var length = blocks.length;
      for (var i = 0; i < length; i++) {
        this.addBlockReporterFeedback(x, y, blocks[i]);
      }
    },

    addBlockReporterFeedback: function(x, y, block) {
      x += block.x;
      y += block.y;
      var args = block.args;
      var length = args.length;
      for (var i = 0; i < length; i++) {
        var a = args[i];
        var ax = x + a.x;
        var ay = y + a.y;
        if (a._type === 't') {
          this.addScriptReporterFeedback(ax, ay, a.script);
        } else {
          if (a.isBlock) {
            this.addBlockReporterFeedback(x, y, a);
          }
          if (a.acceptsDropOf(this.dragScript.blocks[0])) {
            this.addFeedback({
              x: ax,
              y: ay,
              rangeX: this.feedbackRange,
              rangeY: this.feedbackRange,
              type: 'replace',
              block: block,
              arg: a
            });
          }
        }
      }
    },

    addFeedback: function(obj) {
      var dx = obj.x - this.dragScript.x;
      var dy = obj.y - this.dragScript.y;
      var d2 = dx * dx + dy * dy;
      if (Math.abs(dx) > obj.rangeX || Math.abs(dy) > obj.rangeY || d2 > this.feedbackDistance) return;
      this.feedbackDistance = d2;
      this.feedbackInfo = obj;
    },

    feedbackLineWidth: 6,

    renderFeedback: function(info) {
      var canvas = this.feedback;
      var context = this.feedbackContext;
      var b = this.dragScript.blocks[0];
      var l = this.feedbackLineWidth;
      var r = l/2;

      switch (info.type) {
        case 'insert':
        case 'append':
          var pi = b.puzzleInset;
          var pw = b.puzzleWidth;
          var p = b.puzzle;
          setTransform(canvas, 'translate('+(info.x - r)+'px, '+(info.y - r)+'px)');
          canvas.width = b.width + l;
          canvas.height = l + p;
          context.lineWidth = l;
          context.lineCap = 'round';
          context.strokeStyle = '#fff';
          context.moveTo(r, r);
          context.lineTo(pi + r, r);
          context.lineTo(pi + p + r, r + p);
          context.lineTo(pi + pw + p + r, r + p);
          context.lineTo(pi + pw + p * 2 + r, r);
          context.lineTo(canvas.width - r, r);
          context.stroke();
          return;
        case 'replace':
          var w = info.arg.width;
          var h = info.arg.height;
          canvas.width = w + l * 2;
          canvas.height = h + l * 2;
          setTransform(canvas, 'translate('+(info.x - l)+'px, '+(info.y - l)+'px)');

          context.translate(l, l);

          info.arg.pathShadowOn(context);

          context.lineWidth = l;
          context.lineCap = 'round';
          context.strokeStyle = '#fff';
          context.stroke();

          context.globalCompositeOperation = 'destination-out';
          context.beginPath();
          info.arg.pathShadowOn(context);
          context.fill();
          context.globalCompositeOperation = 'source-over';
          context.fillStyle = 'rgba(255, 255, 255, .6)';
          context.fill();
          return;
        // case 'replace': // Scratch 2.0
        //   var w = info.arg.width;
        //   var h = info.arg.height;
        //   l += 1;
        //   canvas.width = w + l * 2;
        //   canvas.height = h + l * 2;
        //   setTransform(canvas, 'translate('+(info.x - l)+'px, '+(info.y - l)+'px)');

        //   context.translate(l, l);

        //   context.save();
        //   context.translate(-10000, -10000);
        //   info.arg.pathShadowOn(context);

        //   context.lineWidth = l;
        //   context.lineCap = 'round';
        //   context.shadowOffsetX = 10000;
        //   context.shadowOffsetY = 10000;
        //   context.shadowBlur = r;
        //   context.shadowColor = '#fff';
        //   context.stroke();
        //   context.restore();

        //   context.globalCompositeOperation = 'destination-out';
        //   info.arg.pathShadowOn(context);
        //   context.fill();
        //   return;
      }
    },

    mouseUp: function(e) {
      this.updateMouse(e);
      if (this.dragging) {
        this.drop();
      } else if (this.shouldDrag) {
        if (this.pressObject.isArg) {
          if (this.pressObject._type === 'm') {

          } else if (this.pressObject.field) {
            this.pressObject.field.select();
          }
        }
      }
      this.dragging = false;
      this.pressed = false;
    },

    drop: function() {
      if (!this.dragging) return;
      if (this.feedbackInfo) this.applyDrop(this.feedbackInfo);

      this.dragScript.el.classList.remove('Visual-script-dragging');
      this.dragScript.removeShadow();
      this.feedback.style.display = 'none';

      this.dragScript = null;
      this.layout();
    },

    applyDrop: function(info) {
      switch (info.type) {
        case 'append':
          info.script.add(this.dragScript);
          return;
        case 'insert':
          info.script.insert(this.dragScript, info.block);
          return;
        case 'replace':
          if (info.arg.isBlock) {
            var pos = info.arg.workspacePosition;
          }
          info.block.replace(info.arg, this.dragScript.blocks[0]);
          if (info.arg.isBlock) {
            this.add(pos.x + 20, pos.y + 20, new Script().add(info.arg));
          }
          return;
      }
    },

    getScroll: function() {
      if (this.el === document.body) {
        return {x: window.scrollX, y: window.scrollY};
      }
      return {x: this.el.scrollLeft, y: this.el.scrollTop};
    },

    updateMouse: function(e) {
      var bb = this.el.getBoundingClientRect();
      this.mouseX = e.clientX - bb.left;
      this.mouseY = e.clientY - bb.top;
      var scroll = this.getScroll();
      this.scrollX = scroll.x;
      this.scrollY = scroll.y;
    },

    scroll: function() {
      var scroll = this.getScroll();
      this.mouseX += scroll.x - this.scrollX;
      this.mouseY += scroll.y - this.scrollY;
      this.scrollX = scroll.x;
      this.scrollY = scroll.y;
      this.drag();
      this.refill();
    },

    layout: function() {
      var p = this.padding;
      var x = p;
      var y = p;
      var width = 0;
      var height = 0;

      var scripts = this.scripts;
      for (var i = scripts.length; i--;) {
        var script = scripts[i];
        if (script === this.dragScript) return;
        if (script.blocks.length === 0) {
          this.remove(script);
          continue;
        }
        x = Math.min(x, script.x);
        y = Math.min(y, script.y);
        width = Math.max(width, script.x - x + script.width);
        height = Math.max(height, script.y - y + script.height);
      }

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
      var scroll = this.getScroll();
      var vw = this.el.offsetWidth + scroll.x + this.extraSpace;
      var vh = this.el.offsetHeight + scroll.y + this.extraSpace;

      this.fill.style.width = Math.max(this.width, vw) + 'px';
      this.fill.style.height = Math.max(this.height, vh) + 'px';
    }
  };


  function Menu(items) {
    this.el = el('Visual-menu');

    this.items = [];

    items = [].slice.call(arguments);
    if (typeof items[0] === 'function') {
      this.action = items.shift();
    }
    var length = items.length;
    for (var i = 0; i < length; i++) {
      this.add(items[i]);
    }

    this.documentMouseDown = this.documentMouseDown.bind(this);
    this.mouseUp = this.mouseUp.bind(this);
  }

  Menu.line = {};

  Menu.prototype = {
    constructor: Menu,

    withAction: function(action, context) {
      this.action = action;
      this.context = context;
      return this;
    },

    withContext: function(context) {
      this.context = context;
      return this;
    },

    add: function(item) {
      if (item === Menu.line) {
        this.el.appendChild(el('Visual-menu-line'));
      } else {
        if (typeof item === 'string') item = [item, item];
        var i = el('Visual-menu-item');
        i.textContent = item[0];
        i.dataset.index = this.items.length;
        this.items.push(item);
        this.el.appendChild(i);
      }
    },

    show: function(ws) {
      this.workspace = ws;
      var bb = ws.el.getBoundingClientRect();
      this.x = bb.left + ws.mouseX;
      this.y = bb.top + ws.mouseY;
      setTransform(this.el, 'translate('+this.x+'px, '+this.y+'px)');
      document.body.appendChild(this.el);
      document.addEventListener('mousedown', this.documentMouseDown, true);
      this.el.addEventListener('mouseup', this.mouseUp, true);
    },

    mouseUp: function(e) {
      var t = e.target;
      while (t) {
        if (t.parentNode === this.el && t.dataset.index) {
          var i = t.dataset.index;
          this.commit(i);
        }
        t = t.parentNode;
      }
      e.stopPropagation();
    },

    documentMouseDown: function(e) {
      var t = e.target;
      while (t) {
        if (t === this.el) {
          e.stopPropagation();
          return;
        }
        t = t.parentNode;
      }
      this.hide();
    },

    commit: function(index) {
      var item = this.items[index];
      if (typeof item[1] === 'function') {
        item[1].call(this.context);
      } else if (typeof this.action === 'function') {
        this.action.call(this.context, item[1]);
      }
      this.hide();
    },

    hide: function() {
      if (this.el.parentNode) {
        this.el.parentNode.removeChild(this.el);
      }
    }
  };


  return {
    Block: Block,
    Script: Script,
    Workspace: Workspace
  };
}
