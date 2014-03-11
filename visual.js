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

  function getWorkspace() {
    var o = this;
    while (o && !o.isWorkspace) {
      o = o.parent;
    }
    return o;
  }

  function getApp() {
    var o = this;
    while (o && !o.isApp) {
      o = o.parent;
    }
    return o;
  }

  function getWorkspacePosition() {
    var o = this;
    var x = 0;
    var y = 0;
    while (o && !o.isWorkspace) {
      x += o.x;
      y += o.y;
      o = o.parent;
    }
    return {x: x, y: y};
  }

  function getWorldPosition() {
    var o = this;
    var x = 0;
    var y = 0;
    while (o && !o.isWorkspace) {
      x += o.x;
      y += o.y;
      o = o.parent;
    }
    if (o) {
      var bb = o.el.getBoundingClientRect();
      x += Math.round(bb.left);
      y += Math.round(bb.top);
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

  Block.prototype.isBlock = true;

  Block.prototype.parent = null;
  Block.prototype.dirty = true;

  Block.prototype.radius = 4;
  Block.prototype.puzzle = 3;
  Block.prototype.puzzleWidth = 9;
  Block.prototype.puzzleInset = 14;

  Block.prototype.pathBlockType = {
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
  };

  Block.prototype.pathCommandShape = function(bottom, context) {
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
  };

  def(Block.prototype, 'spec', {
    get: function() {return this._spec},
    set: function(value) {
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
    }
  });

  def(Block.prototype, 'color', {
    get: function() {return this._color},
    set: function(value) {
      this._color = value;

      if (this.parent) this.draw();
    }
  });

  def(Block.prototype, 'app', {get: getApp});
  def(Block.prototype, 'workspace', {get: getWorkspace});
  def(Block.prototype, 'workspacePosition', {get: getWorkspacePosition});
  def(Block.prototype, 'worldPosition', {get: getWorldPosition});

  def(Block.prototype, 'contextMenu', {get: function() {
    var workspace = this.workspace;
    var pressX = workspace.pressX;
    var pressY = workspace.pressY;
    return new Menu(
      ['Duplicate', function() {
        var pos = this.worldPosition;
        workspace.grab(this.scriptCopy(), pos.x - pressX, pos.y - pressY);
      }],
      Menu.line,
      'Help',
      'Add Comment',
      Menu.line,
      ['Delete', this.destroy]).withContext(this);
  }});

  def(Block.prototype, 'dragObject', {get: function() {return this}}),

  Block.prototype.click = function() {};

  Block.prototype.acceptsDropOf = function(b) {
    if (!this.parent || !this.parent.isBlock) return;
    var args = this.parent.args;
    var i = args.indexOf(this);
    var def = this.parent.inputs[i];
    return def && def.acceptsDropOf(b);
  };

  Block.prototype.add = function(part) {
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
  };

  Block.prototype.replace = function(oldPart, newPart) {
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
  };

  Block.prototype.remove = function(part) {
    if (part.parent !== this) return this;

    part.parent = null;
    var i = this.parts.indexOf(part);
    this.parts.splice(i, 1);

    var array = part.isArg ? this.args : this.labels;
    i = array.indexOf(part);
    array.splice(i, 1);

    this.el.removeChild(part.el);

    return this;
  };

  Block.prototype.destroy = function() {
    if (!this.parent) return this;
    if (this.parent.isScript) {
      this.parent.remove(this);
    } else if (this.parent.isBlock) {
      this.parent.reset(this);
    }
    return this;
  };

  Block.prototype.reset = function(arg) {
    if (arg.parent !== this || !arg.isArg && !arg.isBlock) return this;

    var i = this.args.indexOf(arg);
    this.replace(arg, this.inputs[i]);

    return this;
  };

  Block.prototype.detach = function() {
    if (this.parent.isBlock) {
      this.parent.reset(this);
      return new Script().add(this);
    }
    if (this.parent.isScript) {
      return this.parent.splitAt(this);
    }
  };

  Block.prototype.copy = function() {
    var args = this.args.map(function(a) {return a.copy()});
    return new Block(this.name, args);
  };

  Block.prototype.scriptCopy = function() {
    if (!this.parent || !this.parent.isScript) return new Script().add(this.copy());
    return this.parent.copyAt(this);
  };

  Block.prototype.objectFromPoint = function(x, y) {
    var args = this.args;
    for (var i = args.length; i--;) {
      var arg = args[i];
      var o = arg.objectFromPoint(x - arg.x, y - arg.y);
      if (o) return o;
    }
    return transparentAt(this.context, x, y) ? this : null;
  };

  Block.prototype.moveTo = moveTo;
  Block.prototype.layout = layout;

  Block.prototype.layoutChildren = function() {
    this.parts.forEach(function(p) {
      p.layoutChildren();
    });
    if (this.dirty) {
      this.dirty = false;
      this.layoutSelf();
    }
  };

  Block.prototype.paddingX = 5;
  Block.prototype.paddingY = 3;
  Block.prototype.partPadding = 4;
  Block.prototype.linePadding = 4;
  Block.prototype.scriptPadding = 15;

  Block.prototype.minDistance = function(part) {
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
  };

  Block.prototype.layoutSelf = function() {
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
        lineXs.push([0], [0]);
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
  };

  Block.prototype.pathBlock = function(context) {
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
  };

  Block.prototype.draw = function() {
    this.canvas.width = this.ownWidth;
    this.canvas.height = this.ownHeight;

    this.drawOn(this.context);
  };

  Block.prototype.drawOn = function(context) {
    context.fillStyle = this._color;
    bezel(context, this.pathBlock, this);
  };

  Block.prototype.pathShadowOn = function(context) {
    this.pathBlock(context);
    this.args.forEach(function(a) {
      if (a._type === 't') {
        context.save();
        context.translate(a.x, a.y);
        a.script.pathShadowOn(context);
        context.restore();
      }
    });
  };


  function Label(text) {
    this.el = el('Visual-absolute Visual-label');

    this.text = text;
  }

  Label.measure = metrics('Visual-label');

  Label.prototype.isLabel = true;

  Label.prototype.parent = null;
  Label.prototype.x = 0;
  Label.prototype.y = 0;
  Label.prototype.dirty = false;

  def(Label.prototype, 'text', {
    get: function() {return this._text},
    set: function(value) {
      this.el.textContent = value;
      this._text = value;
      var metrics = Label.measure(value);
      this.width = metrics.width;
      this.height = metrics.height * 1.2 | 0;
    }
  });

  def(Label.prototype, 'app', {get: getApp});
  def(Label.prototype, 'workspace', {get: getWorkspace});
  def(Label.prototype, 'workspacePosition', {get: getWorkspacePosition});
  def(Label.prototype, 'worldPosition', {get: getWorldPosition});

  def(Label.prototype, 'dragObject', {get: function() {return this.parent.dragObject}});

  Label.prototype.layoutSelf = function() {};
  Label.prototype.layoutChildren = layoutNoChildren;
  Label.prototype.layout = layout;
  Label.prototype.moveTo = moveTo;


  function Icon(name) {
    this.el = el('canvas', 'Visual-absolute');
    this.context = this.el.getContext('2d');
    this.name = name;
  }

  Icon.prototype.isIcon = true;

  Icon.prototype.parent = null;
  Icon.prototype.x = 0;
  Icon.prototype.y = 0;
  Icon.prototype.dirty = true;

  def(Icon.prototype, 'app', {get: getApp});
  def(Icon.prototype, 'workspace', {get: getWorkspace});
  def(Icon.prototype, 'workspacePosition', {get: getWorkspacePosition});
  def(Icon.prototype, 'worldPosition', {get: getWorldPosition});

  def(Icon.prototype, 'dragObject', {get: function() {return this.parent.dragObject}});

  Icon.prototype.layoutSelf = function() {
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
  };

  Icon.prototype.layoutChildren = layoutNoChildren;
  Icon.prototype.layout = layout;
  Icon.prototype.moveTo = moveTo;

  Icon.prototype.pathLoopArrow = function(context) {
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

  Arg.prototype.pathArgType = {
    b: 'pathBooleanShape',
    c: 'pathRectShape',
    n: 'pathRoundedShape',
    d: 'pathRoundedShape',
    m: 'pathRectShape',
    s: 'pathRectShape'
  };

  Arg.prototype.isArg = true;

  Arg.prototype.parent = null;
  Arg.prototype.x = 0;
  Arg.prototype.y = 0;
  Arg.prototype.dirty = true;

  def(Arg.prototype, 'value', {
    get: function() {
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
    set: function(value) {
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
    }
  });

  def(Arg.prototype, 'type', {
    get: function() {return this._type},
    set: function(value) {
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
    }
  });

  def(Arg.prototype, 'app', {get: getApp});
  def(Arg.prototype, 'workspace', {get: getWorkspace});
  def(Arg.prototype, 'workspacePosition', {get: getWorkspacePosition});
  def(Arg.prototype, 'worldPosition', {get: getWorldPosition});

  def(Arg.prototype, 'contextMenu', {get: function() {return this.parent.contextMenu}});

  def(Arg.prototype, 'dragObject', {get: function() {return this.parent.dragObject}});

  Arg.prototype.click = function() {
    if (this._type === 'm') {
      // TODO
    } else if (this.isTextArg) {
      this.field.select();
    }
  };

  Arg.prototype.acceptsDropOf = function(b) {
    return 'cmt'.indexOf(this.type) === -1 && (this.type !== 'b' || b.isBoolean);
  };

  Arg.prototype.copy = function() {
    var value = this.type === 't' ? this.script.copy() : this.value;
    return new Arg([this.type, this.menu], value);
  };

  Arg.prototype.objectFromPoint = function(x, y) {
    switch (this._type) {
      case 'b': return null;
      case 't': return this.script.objectFromPoint(x, y);
    }
    return transparentAt(this.context, x, y) ? this : null;
  };

  Arg.prototype.draw = function() {
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    this.drawOn(this.context);
  };

  Arg.prototype.drawOn = function(context) {
    if (this._type === 't') return;

    var field = 'bcm'.indexOf(this._type) === -1;

    context.fillStyle =
      field ? '#fff' :
      this._type === 'c' ? this.field.value : this.color;
    bezel(context, this[this.pathArgType[this._type]], this, true, !field);
  };

  Arg.prototype.pathShadowOn = function(context) {
    if (this._type === 't') return;
    this[this.pathArgType[this._type]].call(this, context);
    context.closePath();
  };

  Arg.prototype.pathRoundedShape = function(context) {
    var w = this.width;
    var h = this.height;
    var r = Math.min(w, h) / 2;

    context.moveTo(0, r);
    context.arc(r, r, r, PI, PI32, false);
    context.arc(w - r, r, r, PI32, 0, false);
    context.arc(w - r, h - r, r, 0, PI12, false);
    context.arc(r, h - r, r, PI12, PI, false);
  };

  Arg.prototype.pathRectShape = function(context) {
    var w = this.width;
    var h = this.height;

    context.moveTo(0, 0);
    context.lineTo(w, 0);
    context.lineTo(w, h);
    context.lineTo(0, h);
  };

  Arg.prototype.pathBooleanShape = function(context) {
    var w = this.width;
    var h = this.height;
    var r = Math.min(w, h) / 2;

    context.moveTo(0, r);
    context.lineTo(r, 0);
    context.lineTo(w - r, 0);
    context.lineTo(w, r);
    context.lineTo(w - r, h);
    context.lineTo(r, h);
  };

  Arg.prototype.drawArrow = function() {
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
  };

  Arg.prototype.layoutSelf = function() {
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
  };

  Arg.prototype.layoutChildren = function() {
    if (this._type === 't') this.script.layoutChildren();
    if (this.dirty) {
      this.dirty = false;
      this.layoutSelf();
    }
  };

  Arg.prototype.layout = layout;
  Arg.prototype.moveTo = moveTo;


  function Script() {
    this.el = el('Visual-absolute Visual-script');

    this.blocks = [];
    this.x = 0;
    this.y = 0;
    this.width = 0;
    this.height = 0;
  }

  Script.prototype.isScript = true;

  Script.prototype.parent = null;
  Script.prototype.x = 0;
  Script.prototype.y = 0;
  Script.prototype.dirty = true;

  def(Script.prototype, 'app', {get: getApp});
  def(Script.prototype, 'workspace', {get: getWorkspace});
  def(Script.prototype, 'workspacePosition', {get: getWorkspacePosition});
  def(Script.prototype, 'worldPosition', {get: getWorldPosition});

  def(Script.prototype, 'hasHat', {get: function() {return this.blocks.length && this.blocks[0].isHat}}),
  def(Script.prototype, 'hasFinal', {get: function() {return this.blocks.length && this.blocks[this.blocks.length-1].isFinal}}),

  def(Script.prototype, 'isReporter', {get: function() {return this.blocks.length && this.blocks[0].isReporter}}),

  Script.prototype.shadow = function(blur, color) {
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
  };

  Script.prototype.addShadow = function(offsetX, offsetY, blur, color) {
    this.removeShadow();

    var canvas = this.shadow(blur, color);
    setTransform(canvas, 'translate('+(offsetX - blur)+'px, '+(offsetY - blur)+'px)');
    this._shadow = canvas;
    this.el.insertBefore(canvas, this.el.firstChild);

    return this;
  };

  Script.prototype.removeShadow = function() {
    if (this._shadow) {
      this.el.removeChild(this._shadow);
      this._shadow = null;
    }
    return this;
  };

  Script.prototype.pathShadowOn = function(context) {
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
  };

  Script.prototype.splitAt = function(topBlock) {
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
    for (; i < length; i++) {
      var b = blocks[i];
      b.parent = script;
      f.appendChild(b.el);
    }

    script.el.appendChild(f);

    this.layout();
    return script;
  };

  Script.prototype.add = function(block) {
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
  };

  Script.prototype.addScript = function(script) {
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
  };

  Script.prototype.insert = function(block, beforeBlock) {
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
  };

  Script.prototype.insertScript = function(script, beforeBlock) {
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
  };

  Script.prototype.replace = function(oldBlock, newBlock) {
    if (oldBlock.parent !== this) return this;

    oldBlock.parent = null;
    newBlock.parent = this;

    var i = this.blocks.indexOf(oldBlock);
    this.blocks.splice(i, 1, newBlock);
    this.el.replaceChild(newBlock.el, oldBlock.el);

    if (this.parent) newBlock.layoutChildren();
    this.layout();

    return this;
  };

  Script.prototype.remove = function(block) {
    if (block.parent !== this) return this;

    block.parent = null;
    var i = this.blocks.indexOf(block);
    this.blocks.splice(i, 1);
    this.el.removeChild(block.el);

    this.layout();

    return this;
  };

  Script.prototype.copy = function() {
    var script = new Script();
    script.addScript({blocks: this.blocks.map(function(b) {return b.copy()})});
    return script;
  };

  Script.prototype.copyAt = function (b) {
    var script = new Script();
    var i = this.blocks.indexOf(b);
    if (i === -1) return script;
    script.addScript({blocks: this.blocks.slice(i).map(function(b) {return b.copy()})});
    return script;
  };

  Script.prototype.objectFromPoint = function(x, y) {
    if (!containsPoint(this, x, y)) return null;
    var blocks = this.blocks;
    for (var i = blocks.length; i--;) {
      var block = blocks[i];
      var o = block.objectFromPoint(x, y - block.y);
      if (o) return o;
    }
    return null;
  };

  Script.prototype.layoutChildren = function() {
    this.blocks.forEach(function(b) {
      b.layoutChildren();
    });
    if (this.dirty) {
      this.dirty = false;
      this.layoutSelf();
    }
  };

  Script.prototype.layoutSelf = function() {
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
  };

  Script.prototype.layout = layout;
  Script.prototype.moveTo = moveTo;


  function Workspace(host) {
    this.el = host;
    this.el.className += ' Visual-workspace';

    this.el.appendChild(this.fill = el('Visual-absolute'));

    this.el.addEventListener('contextmenu', this.disableContextMenu.bind(this));

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

  Workspace.prototype.isWorkspace = true;

  Workspace.prototype.parent = null;

  Workspace.prototype.padding = 20;
  Workspace.prototype.extraSpace = 100;

  def(Workspace.prototype, 'app', {get: getApp});
  def(Workspace.prototype, 'workspace', {get: function() {return this}});
  def(Workspace.prototype, 'workspacePosition', {get: function() {return {x: 0, y: 0}}});
  def(Workspace.prototype, 'worldPosition', {get: getWorldPosition});

  def(Workspace.prototype, 'contextMenu', {get: function() {
    return new Menu(
      'Clean Up',
      'Add Comment');
  }});

  Workspace.prototype.add = function(x, y, script) {
    if (script.parent) script.parent.remove(script);

    script.parent = this;
    this.scripts.push(script);

    script.moveTo(x, y);
    script.layoutChildren();
    this.layout();

    this.el.appendChild(script.el);

    return this;
  };

  Workspace.prototype.remove = function(script) {
    if (script.parent !== this) return this;
    script.parent = null;

    var i = this.scripts.indexOf(script);
    this.scripts.splice(i, 1);
    this.el.removeChild(script.el);

    return this;
  };

  Workspace.prototype.objectFromPoint = function(x, y) {
    if (!containsPoint(this, x, y)) return null;
    var scripts = this.scripts;
    for (var i = scripts.length; i--;) {
      var script = scripts[i];
      var o = script.objectFromPoint(x - script.x, y - script.y);
      if (o) return o;
    }
    return null;
  };

  Workspace.prototype.disableContextMenu = function(e) {
    var t = (e.target.nodeType === 1 ? e.target : e.target.parentNode).tagName;
    if (t !== 'INPUT' && t !== 'TEXTAREA' && t !== 'SELECT') e.preventDefault();
  };

  Workspace.prototype.scroll = function() {
    if (this.el === document.body) {
      this.scrollX = window.scrollX;
      this.scrollY = window.scrollY;
    } else {
      this.scrollX = this.el.scrollLeft;
      this.scrollY = this.el.scrollTop;
    }
    this.refill();
  };

  Workspace.prototype.layout = function() {
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
  };

  Workspace.prototype.refill = function() {
    var vw = this.el.offsetWidth + this.scrollX + this.extraSpace;
    var vh = this.el.offsetHeight + this.scrollY + this.extraSpace;

    this.fill.style.width = Math.max(this.width, vw) + 'px';
    this.fill.style.height = Math.max(this.height, vh) + 'px';
  };


  function App() {
    this.workspaces = [];
    this.palettes = [];
    this.menus = [];

    this.feedback = el('canvas', 'Visual-absolute Visual-feedback');
    this.feedbackContext = this.feedback.getContext('2d');
    this.feedback.style.display = 'none';
    document.body.appendChild(this.feedback);

    document.addEventListener('mousedown', this.mouseDown.bind(this), true);
    document.addEventListener('mousemove', this.mouseMove.bind(this));
    document.addEventListener('mouseup', this.mouseUp.bind(this), true);
  }

  App.prototype.isApp = true;

  App.prototype.parent = null;

  def(App.prototype, 'app', {get: function() {return this}});

  App.prototype.objectFromPoint = function(x, y) {
    var workspaces = this.workspaces;
    for (var i = workspaces.length; i--;) {
      var w = workspaces[i];
      var pos = w.worldPosition;
      var o = w.objectFromPoint(x - pos.x, y - pos.y);
      if (o) return o;
    }
    return null;
  };

  App.prototype.layout = function() {};

  App.prototype.add = function(thing) {
    if (thing.parent) thing.parent.remove(thing);

    thing.parent = this;
    if (thing.isPalette) {
      this.palettes.push(thing);
    }
    if (thing.isWorkspace) {
      this.workspaces.push(thing);
    }
    if (thing.isMenu) {
      this.menus.push(thing);
      document.body.appendChild(thing.el);
    }
    return this;
  };

  App.prototype.remove = function(thing) {
    if (thing.parent !== this) return this;
    thing.parent = null;

    var array =
      thing.isWorkspace ? this.workspaces :
      thing.isPalette ? this.palettes :
      thing.isMenu ? this.menus : [];
    var i = array.indexOf(thing);
    array.splice(i, 1);

    if (thing.isMenu) {
      thing.el.parentNode.removeChild(thing.el);
    }

    return this;
  };

  App.prototype.grab = function(script, offsetX, offsetY) {
    this.drop();
    this.dragging = true;

    if (offsetX === undefined) {
      var pos = script.worldPosition;
      offsetX = pos.x - this.pressX;
      offsetY = pos.y - this.pressY;
    }
    this.dragX = offsetX;
    this.dragY = offsetY;

    if (script.parent) {
      script.parent.remove(script);
    }

    this.dragScript = script;
    this.dragScript.el.classList.add('Visual-script-dragging');
    this.dragScript.moveTo(this.dragX + this.mouseX, this.dragY + this.mouseY);
    this.dragScript.parent = this;
    this.dragScript.layout();
    document.body.appendChild(this.dragScript.el);
    this.dragScript.addShadow(6, 6, 8, 'rgba(0, 0, 0, .3)');
    this.updateFeedback();
  };

  App.prototype.mouseDown = function(e) {
    this.updateMouse(e);

    this.hideMenus(e);
    this.drop();

    this.pressX = this.mouseX;
    this.pressY = this.mouseY;
    this.pressObject = this.objectFromPoint(this.pressX, this.pressY);
    this.shouldDrag = false;

    if (this.pressObject) {
      if (e.button === 0) {
        this.shouldDrag = !(this.pressObject.isWorkspace || this.pressObject.isPalette || this.pressObject.isTextArg && document.activeElement === this.pressObject.field);
        e.preventDefault();

      } else if (e.button === 2) {
        var cm = (this.pressObject || this).contextMenu;
        if (cm) cm.show(this);
        e.preventDefault();
      }
    }

    this.pressed = true;
    this.dragging = false;
  };

  App.prototype.mouseMove = function(e) {
    this.updateMouse(e);

    if (this.dragging) {
      this.dragScript.moveTo(this.dragX + this.mouseX, this.dragY + this.mouseY);
      this.updateFeedback();
      e.preventDefault();
    } else if (this.pressed && this.shouldDrag) {
      var block = this.pressObject.dragObject;
      this.dragWorkspace = block.workspace;
      this.dragPos = block.workspacePosition;
      var pos = block.worldPosition;
      this.grab(block.detach(), pos.x - this.pressX, pos.y - this.pressY);
      e.preventDefault();
    }
  };

  App.prototype.mouseUp = function(e) {
    this.updateMouse(e);

    if (this.dragging) {
      this.drop();
    } else if (this.shouldDrag) {
      this.pressObject.click();
    }

    this.pressed = false;
    this.pressObject = null;

    this.dragging = false
    this.shouldDrag = false;
    this.dragScript = null;
  };

  App.prototype.hideMenus = function(e) {
    if (!this.menus.length) return;

    var t = e.target;
    var els = this.menus.map(function(m) {return m.el});
    while (t) {
      if (els.indexOf(t) === 0) return;
      t = t.parentNode;
    }

    this.menus.forEach(function(m) {
      m.el.parentNode.removeChild(m.el);
      m.parent = null;
    });
    this.menus = [];
  };

  App.prototype.updateMouse = function(e) {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
  };

  App.prototype.drop = function() {
    if (!this.dragging) return;

    document.body.removeChild(this.dragScript.el);
    this.dragScript.parent = null;
    this.dragScript.el.classList.remove('Visual-script-dragging');
    this.dragScript.removeShadow();
    this.feedback.style.display = 'none';

    if (this.feedbackInfo) {
      this.applyDrop(this.feedbackInfo);
    } else {
      var workspaces = this.workspaces;
      for (var i = workspaces.length; i--;) {
        var ws = workspaces[i];
        var bb = ws.el.getBoundingClientRect();
        var x = Math.round(bb.left);
        var y = Math.round(bb.top);
        var w = Math.round(bb.right - x);
        var h = Math.round(bb.bottom - y);
        if (ws.el === document.body || this.mouseX >= x && this.mouseX < x + w && this.mouseY >= x && this.mouseY < y + h) {
          if (!ws.isPalette) {
            ws.add(this.dragX + this.mouseX - x, this.dragY + this.mouseY - y, this.dragScript);
          }
          break;
        }
      }
      if (this.dragWorkspace && !this.dragWorkspace.isPalette && !this.dragScript.parent) {
        this.dragWorkspace.add(this.dragPos.x, this.dragPos.y, this.dragScript);
      }
    }

    this.dragScript = null;
  };

  App.prototype.applyDrop = function(info) {
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
          info.block.workspace.add(pos.x + 20, pos.y + 20, new Script().add(info.arg));
        }
        return;
    }
  };

  App.prototype.updateFeedback = function() {
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
  };

  App.prototype.resetFeedback = function() {
    this.feedbackDistance = Infinity;
    this.feedbackInfo = null;
  };

  App.prototype.commandFeedbackRange = 70;
  App.prototype.feedbackRange = 20;

  App.prototype.showCommandFeedback = function() {
    this.commandHasHat = this.dragScript.hasHat;
    this.commandHasFinal = this.dragScript.hasFinal;
    this.showFeedback(this.addScriptCommandFeedback);
  };

  App.prototype.showReporterFeedback = function() {
    this.showFeedback(this.addScriptReporterFeedback);
  };

  App.prototype.showFeedback = function(p) {
    var workspaces = this.workspaces;
    var length = workspaces.length;
    for (var i = 0; i < length; i++) {
      var w = workspaces[i];
      var pos = w.worldPosition;
      if (!w.isPalette) {
        var scripts = w.scripts;
        var l = scripts.length;
        for (var j = 0; j < l; j++) {
          p.call(this, pos.x, pos.y, scripts[j]);
        }
      }
    }
  };

  App.prototype.addScriptCommandFeedback = function(x, y, script) {
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
  };

  App.prototype.addBlockCommandFeedback = function(x, y, block, isTop) {
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
  };

  App.prototype.addScriptReporterFeedback = function(x, y, script) {
    x += script.x;
    y += script.y;
    var blocks = script.blocks;
    var length = blocks.length;
    for (var i = 0; i < length; i++) {
      this.addBlockReporterFeedback(x, y, blocks[i]);
    }
  };

  App.prototype.addBlockReporterFeedback = function(x, y, block) {
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
  };

  App.prototype.addFeedback = function(obj) {
    var dx = obj.x - this.dragScript.x;
    var dy = obj.y - this.dragScript.y;
    var d2 = dx * dx + dy * dy;
    if (Math.abs(dx) > obj.rangeX || Math.abs(dy) > obj.rangeY || d2 > this.feedbackDistance) return;
    this.feedbackDistance = d2;
    this.feedbackInfo = obj;
  };

  App.prototype.feedbackLineWidth = 6;

  App.prototype.renderFeedback = function(info) {
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
        canvas.width = b.ownWidth + l;
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

    this.el.addEventListener('mouseup', this.mouseUp.bind(this), true);
  }

  Menu.line = {};

  Menu.prototype.isMenu = true;

  Menu.prototype.parent = null;
  Menu.prototype.x = 0;
  Menu.prototype.y = 0;

  def(Menu.prototype, 'app', {get: getApp});

  Menu.prototype.withAction = function(action, context) {
    this.action = action;
    this.context = context;
    return this;
  };

  Menu.prototype.withContext = function(context) {
    this.context = context;
    return this;
  };

  Menu.prototype.add = function(item) {
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
  };

  Menu.prototype.show = function(app) {
    this.moveTo(app.mouseX, app.mouseY);
    app.add(this);
  };

  Menu.prototype.mouseUp = function(e) {
    var t = e.target;
    while (t) {
      if (t.parentNode === this.el && t.dataset.index) {
        var i = t.dataset.index;
        this.commit(i);
        e.stopPropagation();
      }
      t = t.parentNode;
    }
  };

  Menu.prototype.commit = function(index) {
    var item = this.items[index];
    if (typeof item[1] === 'function') {
      item[1].call(this.context);
    } else if (typeof this.action === 'function') {
      this.action.call(this.context, item[1]);
    }
    this.hide();
  };

  Menu.prototype.hide = function() {
    this.app.remove(this);
  };

  Menu.prototype.moveTo = moveTo;


  return {
    Block: Block,
    Label: Label,
    Icon: Icon,
    Arg: Arg,
    Script: Script,
    Workspace: Workspace,
    App: App,
    Menu: Menu
  };
}
