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
  if (!options.getMenu) {
    options.getMenu = function(arg) {
      var m = options.menus[arg.menu];
      return m ? m(arg) : null;
    };
    if (!options.menus) options.menus = {};
  }
  if (!options.getText) {
    options.getText = function(key) {
      var translation = options.strings[key];
      return translation == null ? key : translation;
    };
    if (!options.strings) options.strings = {};
  }
  if (options.animationTime == null) options.animationTime = 0.3;


  function el(tagName, className) {
    var d = document.createElement(className ? tagName : 'div');
    d.className = className || tagName || '';
    return d;
  }

  function ignoreEvent(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function setValue(value) {
    this.value = value;
  }

  function getEl(o) {
    return o.el;
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

  function opaqueObjectFromPoint(x, y) {
    return containsPoint(this, x, y) ? this : null;
  }

  function moveTo(x, y) {
    if (this.x === x && this.y === y) return;
    this.x = x;
    this.y = y;
    setTransform(this.el, 'translate('+x+'px,'+y+'px)');
    return this;
  }

  function slideTo(x, y, time, callback, context) {
    if (typeof time === 'function') {
      context = callback;
      callback = time;
      time = options.animationTime;
    }
    if (this.x === x && this.y === y) {
      if (callback) setTimeout(callback.bind(context));
      return this;
    }
    setTransition(this.el, 'all '+time+'s ease');
    this.el.offsetHeight;
    moveTo.call(this, x, y);
    var self = this;
    setTimeout(function() {
      setTransition(self.el, '');
      if (callback) callback.call(context)
    }, time * 1000);
    return this;
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

  function getTopScript() {
    var o = this;
    while (o.parent) {
      if (o.parent.isWorkspace) return o;
      o = o.parent;
    }
    return null;
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
      if (o.el !== document.body) {
        x -= o.scrollX;
        y -= o.scrollY;
      }
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

  function setTransition(el, transition) {
    el.style.WebkitTransition =
    el.style.MozTransition =
    el.style.msTransition =
    el.style.OTransition =
    el.style.transition = transition;
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
    context.shadowBlur = 1.5;
    context.shadowColor = 'rgba(0, 0, 0, .4)';
    context.fill();

    context.shadowOffsetX = 10000 + s * 1;
    context.shadowOffsetY = 10000 + s * 1;
    context.shadowBlur = 1.5;
    context.shadowColor = 'rgba(255, 255, 255, .3)';
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
    if (typeof category !== 'object') category = options.getCategory(category);

    this.name = info[2];
    this.type = info[0];
    this.spec = options.getText(info[1]);
    this.color = category[2];
  }

  var PI12 = Math.PI * 1/2;
  var PI = Math.PI;
  var PI32 = Math.PI * 3/2;

  Block.prototype.isBlock = true;
  Block.prototype.isDraggable = true;

  Block.prototype.parent = null;
  Block.prototype.dirty = true;

  Block.prototype.radius = 3;
  Block.prototype.puzzle = 3;
  Block.prototype.puzzleWidth = 8;
  Block.prototype.puzzleInset = 13;
  Block.prototype.hatHeight = 13;
  Block.prototype.hatWidth = 80;

  Block.prototype.pathBlockType = {
    c: function(context) {
      this.pathCommandShape(context, true, true);
    },
    f: function(context) {
      this.pathCommandShape(context, false, true);
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
    },
    h: function(context) {
      var r = this.radius;
      var p = this.puzzle;
      var pi = this.puzzleInset;
      var pw = this.puzzleWidth;
      var w = this.ownWidth;
      var h = this.ownHeight - p;
      var hh = this.hatHeight;
      var hp = this.hatPaddingTop;
      var hw = this.hatWidth;
      context.moveTo(0, hh);
      context.quadraticCurveTo(.125*hw, .15*hh, hw/2, 0);
      context.quadraticCurveTo(.875*hw, .15*hh, hw, hh - hp);
      context.arc(w - r, hh - hp + r, r, PI32, 0, false);
      this.pathCommandShape(context, true, false);
    }
  };

  Block.prototype.pathCommandShape = function(context, bottom, top) {
    var r = this.radius;
    var p = this.puzzle;
    var pi = this.puzzleInset;
    var pw = this.puzzleWidth;
    var w = this.ownWidth;
    var h = this.ownHeight - bottom * p;
    if (top) {
      context.moveTo(0, r);
      context.lineTo(r, 0);
      context.lineTo(pi, 0);
      context.lineTo(pi + p, p);
      context.lineTo(pi + pw + p, p);
      context.lineTo(pi + pw + p * 2, 0);
      context.lineTo(w - r, 0);
      context.lineTo(w, r);
    }
    context.lineTo(w, h - r);
    context.lineTo(w - r, h);
    if (bottom) {
      context.lineTo(pi + pw + p * 2, h);
      context.lineTo(pi + pw + p, h + p);
      context.lineTo(pi + p, h + p);
      context.lineTo(pi, h);
    }
    context.lineTo(r, h);
    context.lineTo(0, h - r);
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

      var parts = value.split(/(?:@(\w+)|%(\w+(?:\.\w+)?)|([^\s%@]+|[%@]))/g);
      var i = 0;
      for (;;) {
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
        var text = parts[i];
        if (text && (text = text.trim())) {
          this.add(new Label(text));
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

  def(Block.prototype, 'type', {
    get: function() {return this._type},
    set: function(value) {
      this._type = value;
      this.isHat = value === 'h';
      this.hasPuzzle = value === 'c' || value === 'h';
      this.isFinal = value === 'f';
      this.isCommand = value === 'c' || value === 'f';
      this.isReporter = value === 'r' || value === 'b';
      this.isBoolean = value === 'b';

      this.layout();
    }
  });

  def(Block.prototype, 'state', {get: function() {
    if (!this.parent) return null;
    if (this.parent.isBlock) {
      return {
        block: this.parent,
        arg: this.parent.argIndex(this)
      };
    }
    if (this.parent.isScript) {
      if (this.parent.blocks[0] === this) {
        if (this.parent.parent && this.parent.parent.isWorkspace) {
          return {
            workspace: this.parent.parent,
            pos: this.parent.workspacePosition
          };
        }
        return {
          arg: this.parent.parent
        };
      }
      return {script: this.parent};
    }
    return null;
  }});

  Script.prototype.restore = function(state) {
    if (!state) return this;
    if (state.block) {
      state.block.replace(state.block.args[state.arg], this.blocks[0]);
    } else if (state.script) {
      state.script.add(this);
    } else if (state.workspace) {
      state.workspace.add(state.pos.x, state.pos.y, this);
    } else if (state.arg) {
      state.arg.value = this;
    }
    return this;
  };

  def(Block.prototype, 'app', {get: getApp});
  def(Block.prototype, 'workspace', {get: getWorkspace});
  def(Block.prototype, 'workspacePosition', {get: getWorkspacePosition});
  def(Block.prototype, 'worldPosition', {get: getWorldPosition});
  def(Block.prototype, 'topScript', {get: getTopScript});

  def(Block.prototype, 'contextMenu', {get: function() {
    if (this.workspace.isPalette) {
      return this.help && new Menu(['help', this.help]).translate().withContext(this);
    }
    var app = this.app;
    var pressX = app.pressX;
    var pressY = app.pressY;
    return new Menu(
      ['duplicate', function() {
        var pos = this.worldPosition;
        app.grab(this.scriptCopy(), pos.x - pressX, pos.y - pressY);
      }],
      Menu.line,
      this.help && ['help', this.help],
      'add comment',
      Menu.line,
      ['delete', this.destroy]).translate().withContext(this);
  }});

  def(Block.prototype, 'dragObject', {get: function() {
    if (this.workspace.isPalette) {
      var o = this;
      while (!o.parent.isWorkspace) {
        o = o.parent;
      }
      return o.blocks[0];
    }
    return this;
  }});

  Block.prototype.click = function() {};
  Block.prototype.help = null;

  Block.prototype.acceptsDropOf = function(b) {
    if (!this.parent || !this.parent.isBlock) return;
    var i = this.parent.argIndex(this);
    var def = this.parent.inputs[i];
    return def && def.acceptsDropOf(b);
  };

  Block.prototype.argIndex = function(a) {
    return this.args.indexOf(a);
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
    if (this.workspace.isPalette) {
      return this.scriptCopy();
    }
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

  Block.prototype.toJSON = function() {
    return [this.name].concat(this.args);
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
  Block.prototype.slideTo = slideTo;
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

  Block.prototype.paddingX = 6;
  Block.prototype.paddingTop = 4;
  Block.prototype.hatPaddingTop = 3;
  Block.prototype.paddingBottom = 2;
  Block.prototype.reporterPaddingX = 4;
  Block.prototype.reporterPaddingY = 2;
  Block.prototype.partPadding = 4;
  Block.prototype.lineSpacing = 2;
  Block.prototype.scriptPadding = 15;

  Block.prototype.minDistance = function(part) {
    if (this.isBoolean) {
      return (
        part.isBlock && part._type === 'r' && !part.hasScript ? this.reporterPaddingX + part.height/4 | 0 :
        part._type !== 'b' ? this.reporterPaddingX + part.height/2 | 0 :
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
    var xp = this.isReporter ? this.reporterPaddingX : this.paddingX;
    var tp = this.isReporter ? this.reporterPaddingY : this.paddingTop;
    var bp = this.isReporter ? this.reporterPaddingY : this.paddingBottom;
    var pp = this.partPadding;
    var ls = this.lineSpacing;
    var sp = this.scriptPadding;
    var cmw = this.puzzle * 2 + this.puzzleInset + this.puzzleWidth;
    var command = this.isCommand;

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
      lineHeights[line] = 12;
    }
    width = Math.max(width + xp * 2, this.isHat || this.hasScript ? 83 : command ? 39 : 0);

    var y = this.isHat ? this.hatHeight : tp;
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
      y += lh + ls;
    }
    var height = y - ls + bp;

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
    this.pathBlockType[this._type].call(this, context);
    context.closePath();
    var w = this.ownWidth;
    var r = this.radius;
    var ri = r - 1;
    var p = this.puzzle;
    var pi = this.puzzleInset;
    var pw = this.puzzleWidth;
    this.args.forEach(function(a) {
      if (a._type === 't') {
        var x = a.x;
        var y = a.y;
        var h = a.height;
        context.moveTo(x + ri, y);
        context.lineTo(x, y + ri);
        context.lineTo(x, y + h - ri);
        context.lineTo(x + ri, y + h);
        context.lineTo(w - r, y + h);
        context.lineTo(w, y + h + r);
        context.lineTo(w, y - r);
        context.lineTo(w - r, y);
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
  Label.prototype.slideTo = slideTo;


  function Icon(name) {
    this.el = el('canvas', 'Visual-absolute');
    this.context = this.el.getContext('2d');
    this.name = name;
    this.fn = this.icons[name] || this.icons.empty;
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

  Icon.prototype.icons = {
    loop: function(context) {
      context.canvas.width = 14;
      context.canvas.height = 11;

      this.pathLoopArrow(context);
      context.fillStyle = 'rgba(0, 0, 0, .3)';
      context.fill();

      context.translate(-1, -1);
      this.pathLoopArrow(context);
      context.fillStyle = 'rgba(255, 255, 255, .9)';
      context.fill();
    },
    empty: function(context) {
      context.canvas.width = 0;
      context.canvas.height = 0;
    }
  };

  Icon.prototype.redraw = function() {
    this.fn(this.context);
  };

  Icon.prototype.layoutSelf = function() {
    this.fn(this.context);

    this.width = this.el.width;
    this.height = this.el.height;
  };

  Icon.prototype.layoutChildren = layoutNoChildren;
  Icon.prototype.layout = layout;
  Icon.prototype.moveTo = moveTo;
  Icon.prototype.slideTo = slideTo;

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
    d: 'pathRoundedShape',
    l: 'pathNoShape',
    m: 'pathRectShape',
    n: 'pathRoundedShape',
    s: 'pathRectShape'
  };

  Arg.prototype.isArg = true;
  Arg.prototype.isDraggable = true;

  Arg.prototype.parent = null;
  Arg.prototype.x = 0;
  Arg.prototype.y = 0;
  Arg.prototype.dirty = true;

  Arg.prototype.fieldPadding = 4;

  def(Arg.prototype, 'value', {
    get: function() {
      return this._type === 't' ? this.script : this._value;
    },
    set: function(value) {
      if (this._type === 't') {
        if (value.isScript) {
          this.el.removeChild(this.script.el);
          this.script.parent = null;
          this.script = value;
          if (value.parent) value.parent.remove(value);
          value.moveTo(0, 0);
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
      if (this._type !== 'm' && this._type !== 'l' && (this._type !== 'd' || !isNaN(value))) {
        this._value = value;
        if (this.field) this.field.value = value;
        this.layout();
        return;
      }
      this._value = value;
      var text = this.shouldTranslate(value) ? options.getText(value) : value;
      if (this._type === 'm' || this._type === 'l') {
        this.field.textContent = text;
      } else {
        this.field.value = text;
      }
      this.layout();
      return;
    }
  });

  Arg.prototype.shouldTranslate = function(value) {
    return true;
  };

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
          this.field.addEventListener('input', this.change.bind(this));
          this.isTextArg = true;
          break;
        case 'm':
          arrow = true;
          this.field = el('Visual-absolute Visual-field Visual-enum-field');
          break;
        case 'l':
          this.field = el('Visual-absolute Visual-label');
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

  Arg.prototype.change = function() {
    this._value = this.field.value;
    this.layout();
  };

  def(Arg.prototype, 'app', {get: getApp});
  def(Arg.prototype, 'workspace', {get: getWorkspace});
  def(Arg.prototype, 'workspacePosition', {get: getWorkspacePosition});
  def(Arg.prototype, 'worldPosition', {get: getWorldPosition});

  def(Arg.prototype, 'contextMenu', {get: function() {
    if (this._type === 'l' && this.menu) {
      var m = this.parent.contextMenu || new Menu;
      var src = options.getMenu(this);
      if (src && src.items.length) {
        m.add(Menu.line);
        src.items.forEach(function(item) {
          if (item === Menu.line || typeof item[1] === 'function') {
            m.add(item);
          } else {
            m.add([item[0], setValue.bind(this, item[1])]);
          }
        }, this);
      }
      return m;
    }
    return this.parent.contextMenu;
  }});

  def(Arg.prototype, 'dragObject', {get: function() {return this.parent.dragObject}});

  Arg.prototype.click = function(x, y) {
    if (this._type === 'd') {
      var pos = this.worldPosition;
    }
    if (this._type === 'm' || this._type === 'd' && x >= pos.x + this.arrowX) {
      var menu = options.getMenu(this);
      if (menu) {
        pos = pos || this.worldPosition;
        menu.withAction(setValue, this).showAt(pos.x, pos.y + this.height, this.app);
      }
    } else if (this.isTextArg) {
      this.field.select();
    }
  };

  Arg.prototype.acceptsDropOf = function(b) {
    return this.type !== 't';
  };

  Arg.prototype.copy = function() {
    var value = this.type === 't' ? this.script.copy() : this.value;
    return new Arg([this.type, this.menu], value);
  };

  Arg.prototype.toJSON = function() {
    return this._type === 't' ? this.script.toJSON() : this.value;
  };

  Arg.prototype.objectFromPoint = function(x, y) {
    switch (this._type) {
      case 'b': return null;
      case 'l': return containsPoint(this, x, y) ? this : null;
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
    this[this._type === 'l' ? 'pathRectShape' : this.pathArgType[this._type]].call(this, context);
    context.closePath();
  };

  Arg.prototype.pathRoundedShape = function(context) {
    var w = this.width;
    var h = this.height;
    var r = Math.min(w, h) / 2;

    context.moveTo(0, r + .5);
    context.arc(r, r + .5, r, PI, PI32, false);
    context.arc(w - r, r + .5, r, PI32, 0, false);
    context.arc(w - r, h - r - .5, r, 0, PI12, false);
    context.arc(r, h - r - .5, r, PI12, PI, false);
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

  Arg.prototype.pathNoShape = function(context) {};

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
      c.fillStyle = 'rgba(0, 0, 0, .1)';
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
        var w = Math.max(6, metrics.width) + this.fieldPadding * 2;
        if (this.arrow) {
          this.width = w + this.arrow.width + 1;
          w -= this.fieldPadding - 2;
        } else {
          this.width = w;
        }
        this.height = metrics.height + 1;
        this.field.style.width = w + 'px';
        this.field.style.height = this.height + 'px';
        // this.field.style.lineHeight = this.height + 'px';
        if (this.arrow) {
          this.arrowX = this.width - this.arrow.width - 3;
          this.arrowY = (this.height - this.arrow.height) / 2 | 0;
          setTransform(this.arrow, 'translate('+this.arrowX+'px, '+this.arrowY+'px)');
        }
        break;
      case 'l':
        var metrics = Label.measure(this.field.textContent);
        this.width = metrics.width;
        this.height = metrics.height * 1.2 | 0;
        break;
      case 't':
        this.width = 0;
        this.height = Math.max(9, this.script.height);
        break;
      case 'b':
        this.width = 27;
        this.height = 15;
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
  Arg.prototype.slideTo = slideTo;


  function Script() {
    this.el = el('Visual-absolute Visual-script');

    this.effectFns = [];
    this.effects = [];

    this.blocks = [];
    this.x = 0;
    this.y = 0;
    this.width = 0;
    this.height = 0;
  }

  Script.prototype.isScript = true;

  Script.prototype.parent = null;
  Script.prototype.dirty = true;

  def(Script.prototype, 'app', {get: getApp});
  def(Script.prototype, 'workspace', {get: getWorkspace});
  def(Script.prototype, 'workspacePosition', {get: getWorkspacePosition});
  def(Script.prototype, 'worldPosition', {get: getWorldPosition});
  def(Script.prototype, 'topScript', {get: getTopScript});

  def(Script.prototype, 'hasHat', {get: function() {return this.blocks.length && this.blocks[0].isHat}});
  def(Script.prototype, 'hasFinal', {get: function() {return this.blocks.length && this.blocks[this.blocks.length-1].isFinal}});

  def(Script.prototype, 'isReporter', {get: function() {return this.blocks.length && this.blocks[0].isReporter}});
  def(Script.prototype, 'isEmpty', {get: function() {return !this.blocks.length}});

  Script.prototype.shadow = function(offsetX, offsetY, blur, color) {
    var canvas = el('canvas', 'Visual-absolute');
    setTransform(canvas, 'translate('+(offsetX - blur)+'px, '+(offsetY - blur)+'px)');
    canvas.width = this.width + blur * 2;
    canvas.height = this.ownHeight + blur * 2;

    var context = canvas.getContext('2d');
    context.save();
    context.shadowColor = color;
    context.shadowBlur = blur;
    context.shadowOffsetX = 10000 + blur;
    context.shadowOffsetY = 10000 + blur;
    context.translate(-10000, -10000);
    this.pathShadowOn(context);
    context.fill();
    context.restore();

    return canvas;
  };

  Script.prototype.addShadow = function(offsetX, offsetY, blur, color) {
    if (!this._shadow) {
      this.addEffect(this._shadow = this.shadow.bind(this, offsetX, offsetY, blur, color));
    }
    return this;
  };

  Script.prototype.removeShadow = function() {
    this.removeEffect(this._shadow);
    this._shadow = null;
    return this;
  };

  Script.prototype.addEffect = function(fn) {
    var effect = fn.call(this);
    this.el.insertBefore(effect, this.el.firstChild);
    this.effectFns.push(fn);
    this.effects.push(effect);
    return this;
  };

  Script.prototype.removeEffect = function(fn) {
    var i = this.effectFns.indexOf(fn);
    if (i !== -1) {
      this.el.removeChild(this.effects[i]);
      this.effectFns.splice(i, 1);
      this.effects.splice(i, 1);
    }
    return this;
  };

  Script.prototype.outline = function(size, color) {
    var canvas = el('canvas', 'Visual-absolute');
    setTransform(canvas, 'translate('+(-size)+'px, '+(-size)+'px)');
    canvas.width = this.width + size * 2;
    canvas.height = this.ownHeight + size * 2;

    var context = canvas.getContext('2d');
    context.save();
    context.shadowColor = color;
    context.shadowBlur = 0;
    context.translate(-10000, -10000);
    this.pathShadowOn(context);
    for (var x = 0; x <= 2; x += 2) {
      for (var y = 0; y <= 2; y += 2) {
        context.shadowOffsetX = 10000 + x * size;
        context.shadowOffsetY = 10000 + y * size;
        context.fill();
      }
    }
    context.restore();

    return canvas;
  };

  Script.prototype.addOutline = function(size, color) {
    if (!this._outline) {
      this.addEffect(this._outline = this.outline.bind(this, size, color));
    }
    return this;
  };

  Script.prototype.removeOutline = function() {
    this.removeEffect(this._outline);
    this._outline = null;
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
      blocks[i].layoutChildren();
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

  Script.prototype.toJSON = function() {
    return this.parent && this.parent.isWorkspace ? [this.x, this.y, this.blocks] : this.blocks;
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
    for (var i = 0; i < length;) {
      var b = blocks[i];
      b.moveTo(0, y);
      w = Math.max(w, b.width);
      i++;
      y += b.height;
    }

    this.width = this.ownWidth = w;
    this.height = y;
    this.ownHeight = this.height + (b ? b.ownHeight - b.height : 0);

    var l = this.effects.length;
    for (var i = 0; i < l; i++) {
      var effect = this.effects[i];
      this.el.replaceChild(this.effects[i] = this.effectFns[i].call(this), effect);
    }
  };

  Script.prototype.layout = layout;
  Script.prototype.moveTo = moveTo;
  Script.prototype.slideTo = slideTo;


  function Comment(text, width, height, collapse) {
    this.el = el('Visual-absolute Visual-comment');

    this.el.appendChild(this.canvas = el('canvas', 'Visual-absolute'));
    this.context = this.canvas.getContext('2d');

    this.el.appendChild(this.title = el('Visual-comment-title Visual-absolute'));
    setTransform(this.title, 'translate(16px,1px)');
    this.title.style.height = this.title.style.lineHeight = this.titleHeight + 'px';

    this.el.appendChild(this.field = el('textarea', 'Visual-comment-field Visual-absolute'));
    setTransform(this.field, 'translate(0,'+this.titleHeight+'px)');

    this.effectFns = [];
    this.effects = [];

    this.x = 0;
    this.y = 0;
    this.width = this.ownWidth = width || 150;
    this.height = this.ownHeight = this.fullHeight = height || 200;

    this.text = text || '';
    this.collapse = !!collapse;
  }

  Comment.prototype.isComment = true;
  Comment.prototype.isDraggable = true;

  Comment.prototype.parent = null;
  Comment.prototype.dirty = true;

  Comment.prototype.titleHeight = 18;
  Comment.prototype.radius = 5;
  Comment.prototype.arrowColor = '#808080';
  // Comment.prototype.borderColor = 'rgba(80, 80, 80, .2)';
  Comment.prototype.borderColor = '#d0d1d2';
  Comment.prototype.bodyColor = '#ffffd2';
  Comment.prototype.titleColor = '#ffffa5';

  def(Comment.prototype, 'app', {get: getApp});
  def(Comment.prototype, 'workspace', {get: getWorkspace});
  def(Comment.prototype, 'workspacePosition', {get: getWorkspacePosition});
  def(Comment.prototype, 'worldPosition', {get: getWorldPosition});

  def(Comment.prototype, 'text', {
    get: function() {return this.field.value},
    set: function(value) {
      this.field.value = this.title.textContent = value;
    }
  });

  def(Comment.prototype, 'collapse', {
    get: function() {return this._collapse},
    set: function(value) {
      if (this._collapse !== value) {
        this._collapse = value;
        this.title.textContent = this.field.value;
        this.layout();
      }
    }
  });

  def(Comment.prototype, 'contextMenu', {get: function() {
    if (this.workspace.isPalette) {
      return null;
    }
    var app = this.app;
    var pressX = app.pressX;
    var pressY = app.pressY;
    return new Menu(
      ['duplicate', function() {
        var pos = this.worldPosition;
        app.grab(this.copy(), pos.x - pressX, pos.y - pressY);
      }],
      Menu.line,
      ['delete', this.destroy]).translate().withContext(this);
  }});

  Comment.prototype.destroy = function() {
    if (!this.parent) return this;
    if (this.parent) {
      this.parent.remove(this);
    }
    return this;
  };

  def(Comment.prototype, 'state', {get: function() {
    return {
      workspace: this.workspace,
      pos: this.workspacePosition
    };
  }});

  Comment.prototype.restore = function(state) {
    state.workspace.add(state.pos.x, state.pos.y, this);
  };

  def(Comment.prototype, 'dragObject', {get: function() {return this}});

  Comment.prototype.detach = function() {
    return this.workspace.isPalette ? this.copy() : this;
  };

  Comment.prototype.click = function(x, y) {
    if (y - this.worldPosition.y < this.titleHeight) {
      this.collapse = !this.collapse;
    } else {
      this.field.focus();
    }
  };

  Comment.prototype.copy = function() {
    return new Comment(this.text, this.width, this.fullHeight, this.collapse);
  };

  Comment.prototype.shadow = Script.prototype.shadow;
  Comment.prototype.addShadow = Script.prototype.addShadow;
  Comment.prototype.removeShadow = Script.prototype.removeShadow;
  Comment.prototype.outline = Script.prototype.outline;
  Comment.prototype.addOutline = Script.prototype.addOutline;
  Comment.prototype.removeOutline = Script.prototype.removeOutline;
  Comment.prototype.addEffect = Script.prototype.addEffect;
  Comment.prototype.removeEffect = Script.prototype.removeEffect;

  Comment.prototype.layoutSelf = function() {
    var w = this.width;
    var h = this._collapse ? this.titleHeight + 2 : this.fullHeight;
    if (this._collapse) {
      this.title.style.width = (w - 20) + 'px';
      this.field.style.visibility = 'hidden';
      this.title.style.visibility = 'visible';
    } else {
      this.field.style.width = w + 'px';
      this.field.style.height = (h - this.titleHeight) + 'px';
      this.field.style.visibility = 'visible';
      this.title.style.visibility = 'hidden';
    }
    this.canvas.width = this.ownWidth = w;
    this.canvas.height = this.height = this.ownHeight = h;
    this.draw(this.context);
  };

  Comment.prototype.draw = function(context) {
    var w = this.width;
    var h = this.height;
    var th = this.titleHeight;
    var r = this.radius;
    var r1 = this.radius + 1.5;
    var r2 = this.radius + 1;

    context.beginPath();
    context.arc(r1, r1, r2, PI, PI32, false);
    context.arc(w - r1, r1, r2, PI32, 0, false);
    context.arc(w - r1, h - r1, r2, 0, PI12, false);
    context.arc(r1, h - r1, r2, PI12, PI, false);
    context.closePath();
    context.strokeStyle = this.borderColor;
    context.stroke();

    context.beginPath();
    context.arc(r2, r2, r, PI, PI32, false);
    context.arc(w - r2, r2, r, PI32, 0, false);
    if (this._collapse) {
      context.arc(w - r2, h - r2, r, 0, PI12, false);
      context.arc(r2, h - r2, r, PI12, PI, false);
    } else {
      context.lineTo(w - 1, th);
      context.lineTo(1, th);
    }
    context.fillStyle = this.titleColor;
    context.fill();

    if (!this._collapse) {
      context.beginPath();
      context.moveTo(1, th);
      context.lineTo(w - 1, th);
      context.arc(w - r2, h - r2, r, 0, PI12, false);
      context.arc(r2, h - r2, r, PI12, PI, false);
      context.fillStyle = this.bodyColor;
      context.fill();
    }

    context.beginPath();
    if (this._collapse) {
      context.moveTo(6, 4);
      context.lineTo(12, 9.5);
      context.lineTo(6, 15);
    } else {
      context.moveTo(4, 6);
      context.lineTo(9.5, 12);
      context.lineTo(15, 6);
    }
    context.fillStyle = this.arrowColor;
    context.fill();
  };

  Comment.prototype.pathShadowOn = function(context) {
    var w = this.width;
    var h = this.height;
    var r = this.radius;
    context.moveTo(0, r);
    context.arc(r, r, r, PI, PI32, false);
    context.arc(w - r, r, r, PI32, 0, false);
    context.arc(w - r, h - r, r, 0, PI12, false);
    context.arc(r, h - r, r, PI12, PI, false);
  };

  Comment.prototype.objectFromPoint = opaqueObjectFromPoint;
  Comment.prototype.layoutChildren = layoutNoChildren;
  Comment.prototype.layout = layout;
  Comment.prototype.moveTo = moveTo;
  Comment.prototype.slideTo = slideTo;


  function Workspace(host) {
    this.el = host;
    this.el.className += ' Visual-workspace Visual-no-select';

    this.el.appendChild(this.fill = el('Visual-absolute'));

    this.scripts = [];

    if (host.tagName === 'BODY' && host.parentNode) {
      host.parentNode.style.height = '100%';
      window.addEventListener('resize', this.resize.bind(this));
      window.addEventListener('scroll', this.scroll.bind(this));
    } else {
      this.el.addEventListener('scroll', this.scroll.bind(this));
    }

    this.resize();
    this.layout();
  }

  Workspace.prototype.isWorkspace = true;

  Workspace.prototype.parent = null;
  Workspace.prototype.scrollX = 0;
  Workspace.prototype.scrollY = 0;

  Workspace.prototype.paddingX = 20;
  Workspace.prototype.paddingY = 20;
  Workspace.prototype.extraSpace = 100;
  Workspace.prototype.spacing = 20;

  def(Workspace.prototype, 'app', {get: getApp});
  def(Workspace.prototype, 'workspace', {get: function() {return this}});
  def(Workspace.prototype, 'workspacePosition', {get: function() {return {x: 0, y: 0}}});
  def(Workspace.prototype, 'worldPosition', {get: getWorldPosition});

  def(Workspace.prototype, 'contextMenu', {get: function() {
    if (this.isPalette) return;
    var app = this.app;
    var pos = this.worldPosition;
    var pressX = app.pressX - pos.x;
    var pressY = app.pressY - pos.y;
    return new Menu(
      ['clean up', this.cleanUp],
      ['add comment', function() {
        this.add(new Comment('add comment here...').moveTo(pressX, pressY));
      }]).translate().withContext(this);
  }});

  Workspace.prototype.add = function(x, y, script) {
    if (x && script == null && y == null) {
      script = x;
      x = null;
    }
    if (script.parent) script.parent.remove(script);

    script.parent = this;
    this.scripts.push(script);

    if (x != null) script.moveTo(x, y);
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
    this.layout();

    return this;
  };

  Workspace.prototype.clear = function() {
    var scripts = this.scripts;
    for (var i = scripts.length; i--;) {
      var s = scripts[i];
      if (!s.isSpace) this.el.removeChild(s.el);
      s.parent = null;
    }
    this.scripts = [];
    this.contentWidth = this.paddingX + this.extraSpace;
    this.contentHeight = this.paddingY + this.extraSpace;
    this.refill();
    return this;
  };

  Workspace.prototype.objectFromPoint = function(x, y) {
    if (x < this.scrollX || y < this.scrollY || x > this.scrollX + this.width || y > this.scrollY + this.height) return null;
    var scripts = this.scripts;
    for (var i = scripts.length; i--;) {
      var script = scripts[i];
      if (script.isSpace) continue;
      var o = script.objectFromPoint(x - script.x, y - script.y);
      if (o) return o;
    }
    return this;
  };

  Workspace.prototype.scroll = function() {
    if (this.el === document.body) {
      this.scrollX = window.scrollX;
      this.scrollY = window.scrollY;
    } else {
      this.scrollX = this.el.scrollLeft;
      this.scrollY = this.el.scrollTop;
    }
    if (!this.isPalette) this.refill();
  };

  Workspace.prototype.layout = function() {
    var px = this.paddingX;
    var py = this.paddingY;
    var x = px;
    var y = py;
    var width = 0;
    var height = 0;

    var scripts = this.scripts;
    for (var i = scripts.length; i--;) {
      var script = scripts[i];
      if (script === this.dragScript) return;
      if (script.isScript && script.blocks.length === 0) {
        this.remove(script);
        continue;
      }
      x = Math.min(x, script.x);
      y = Math.min(y, script.y);
      width = Math.max(width, script.x - x + script.ownWidth);
      height = Math.max(height, script.y - y + script.ownHeight);
    }

    if (x < px || y < py) {
      x -= px;
      y -= py;
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

    this.contentWidth = width;
    this.contentHeight = height;

    this.refill();
  };

  Workspace.prototype.resize = function() {
    this.width = this.el.offsetWidth;
    this.height = this.el.offsetHeight;
    this.refill();
  };

  Workspace.prototype.refill = function() {
    var vw = this.width + this.scrollX + this.extraSpace;
    var vh = this.height + this.scrollY + this.extraSpace;

    this.fill.style.width = Math.max(this.contentWidth, vw) + 'px';
    this.fill.style.height = Math.max(this.contentHeight, vh) + 'px';
  };

  Workspace.prototype.cleanUp = function() {
    var scripts = this.scripts;
    scripts.sort(function(a, b) {
      return a.y - b.y;
    });
    var y = this.paddingY;
    var length = scripts.length;
    for (var i = 0; i < length; i++) {
      var s = scripts[i];
      s.moveTo(this.paddingX, y);
      y += s.height + this.spacing;
    }
    this.layout();
  };


  function Palette(host) {
    Workspace.call(this, host);
  }

  Palette.space = function(size) {
    return {
      isSpace: true,
      size: size == null ? Palette.prototype.spaceSize : size
    };
  };

  Palette.element = function(el) {
    return new PaletteElement(el);
  };

  Palette.prototype = Object.create(Workspace.prototype);
  Palette.prototype.constructor = Palette;

  Palette.prototype.isPalette = true;
  Palette.prototype.paddingX = 10;
  Palette.prototype.paddingY = 10;
  Palette.prototype.extraSpace = 10;
  Palette.prototype.spacing = 7;
  Palette.prototype.spaceSize = 24;

  Palette.prototype.cleanUp = undefined;

  Palette.prototype.add = function(script) {
    if (script.parent) script.parent.remove(script);

    this.scripts.push(script);
    script.parent = this;

    if (script.isSpace) {
      this.contentHeight += script.size - (this.scripts.length > 1 ? this.spacing : 0);
    } else {
      var y = this.scripts.length > 1 ? this.contentHeight - this.extraSpace + this.spacing : this.paddingY;
      script.moveTo(this.paddingX, y);

      if (script.isElement) this.el.appendChild(script.el);
      script.layoutChildren();
      this.contentWidth = Math.max(this.contentWidth, this.paddingX + script.width + this.extraSpace)
      this.contentHeight = y + script.ownHeight + this.extraSpace;
      if (!script.isElement) this.el.appendChild(script.el);
    }

    this.refill();
    return this;
  };

  Palette.prototype.insert = function(script, before) {
    if (!before || before.parent !== this) return this.add(script);

    if (script.parent) script.parent.remove(script);

    var i = this.scripts.indexOf(before);
    this.scripts.splice(i, 0, script);
    script.parent = this;

    if (!script.isSpace) {
      script.layoutChildren();
      this.el.appendChild(script.el);
    }

    this.layout();

    return this;
  };

  Palette.prototype.refill = function() {
    this.fill.style.width = this.contentWidth + 'px';
    this.fill.style.height = this.contentHeight + 'px';
  };

  Palette.prototype.layout = function() {
    var px = this.paddingX;
    var py = this.paddingY;
    var sp = this.spacing;
    var es = this.extraSpace;

    var y = py;
    var w = 0;
    var scripts = this.scripts;
    var length = scripts.length;
    for (var i = 0; i < length; i++) {
      var s = scripts[i];
      if (s.isSpace) {
        y += s.size - (i === 0 ? 0 : sp);
      } else {
        s.moveTo(px, y);
        w = Math.max(w, s.ownWidth);
        y += s.ownHeight + sp;
      }
    }

    this.contentHeight = y - sp + es;
    this.contentWidth = px + w + es;
    this.refill()
  };

  function PaletteElement(content) {
    this.el = el('Visual-absolute');
    this.el.appendChild(this.content = content);
  }

  PaletteElement.prototype.isElement = true;

  PaletteElement.prototype.parent = null;
  PaletteElement.prototype.x = 0;
  PaletteElement.prototype.y = 0;
  PaletteElement.prototype.dirty = true;

  PaletteElement.prototype.objectFromPoint = opaqueObjectFromPoint;

  PaletteElement.prototype.layoutSelf = function() {
    this.width = this.ownWidth = this.content.offsetWidth;
    this.height = this.ownHeight = this.content.offsetHeight;
  };

  PaletteElement.prototype.layoutChildren = layoutNoChildren;
  PaletteElement.prototype.layout = layout;
  PaletteElement.prototype.moveTo = moveTo;
  PaletteElement.prototype.slideTo = slideTo;


  function Target(host) {
    this.el = host;
    this.resize();
  }

  Target.prototype.isWorkspace = true;
  Target.prototype.isTarget = true;

  Target.prototype.scrollX = 0;
  Target.prototype.scrollY = 0;

  def(Target.prototype, 'app', {get: getApp});
  def(Target.prototype, 'workspace', {get: function() {return this}});
  def(Target.prototype, 'workspacePosition', {get: function() {return {x: 0, y: 0}}});
  def(Target.prototype, 'worldPosition', {get: getWorldPosition});

  Target.prototype.objectFromPoint = opaqueObjectFromPoint;

  Target.prototype.resize = function() {
    this.width = this.el.offsetWidth;
    this.height = this.el.offsetHeight;
  };

  Target.prototype.acceptsDropOf = function(script) {
    return true;
  };

  Target.prototype.showFeedback = function(script) {
    this.el.classList.add('feedback');
  };

  Target.prototype.hideFeedback = function() {
    this.el.classList.remove('feedback');
  };

  Target.prototype.drop = function(script) {
    return true;
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
    document.addEventListener('contextmenu', this.disableContextMenu.bind(this));
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
    if (thing.install) {
      thing.install(this);
    }

    return this;
  };

  App.prototype.remove = function(thing) {
    if (thing.parent !== this) return this;
    thing.parent = null;

    if (thing.isPalette) {
      var i = this.palettes.indexOf(thing);
      this.palettes.splice(i, 1);
    }
    if (thing.isWorkspace) {
      var i = this.workspaces.indexOf(thing);
      this.workspaces.splice(i, 1);
    }
    if (thing.isMenu) {
      var i = this.menus.indexOf(thing);
      this.menus.splice(i, 1);
      thing.el.parentNode.removeChild(thing.el);
    }
    if (thing.uninstall) {
      thing.uninstall(this);
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
    this.dragScript.el.classList.add('Visual-dragging');
    this.dragScript.moveTo(this.dragX + this.mouseX, this.dragY + this.mouseY);
    this.dragScript.parent = this;
    document.body.appendChild(this.dragScript.el);
    this.dragScript.layoutChildren();
    this.dragScript.addShadow(6, 6, 8, 'rgba(0, 0, 0, .3)');
    this.updateFeedback();
  };

  App.prototype.hideMenus = function() {
    if (!this.menus.length) return this;
    this.menus.forEach(function(m) {
      m.el.parentNode.removeChild(m.el);
      m.parent = null;
    });
    this.menus = [];
    return this;
  };

  App.prototype.mouseDown = function(e) {
    this.updateMouse(e);

    this.menuMouseDown(e);

    var pressType = this.pressType(e);
    if (pressType !== 'workspace' && (pressType !== 'input' || e.button === 2)) return;

    this.pressX = this.mouseX;
    this.pressY = this.mouseY;
    this.pressObject = this.objectFromPoint(this.pressX, this.pressY);
    this.shouldDrag = false;

    if (this.pressObject && !this.dragging) {
      if (e.button === 0) {
        this.shouldDrag = this.pressObject.isDraggable && !((this.pressObject.isTextArg || this.pressObject.isComment) && e.target === this.pressObject.field);
      } else if (e.button === 2) {
        this.hideMenus();
        var cm = (this.pressObject || this).contextMenu;
        if (cm) cm.show(this);
        e.preventDefault();
      }
    }

    this.drop();

    if (this.shouldDrag) {
      document.activeElement.blur();
      e.preventDefault();
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
      this.dragState = block.state;
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
      this.pressObject.click(this.pressX, this.pressY);
    }

    this.pressed = false;
    this.pressObject = null;

    this.dragging = false
    this.shouldDrag = false;
    this.dragScript = null;
  };

  App.prototype.disableContextMenu = function(e) {
    var pressType = this.pressType(e);
    if (pressType === 'workspace' || pressType === 'menu') {
      e.preventDefault();
    }
  };

  App.prototype.pressType = function(e) {
    var t = e.target;
    var workspaceEls = this.workspaces.map(getEl);
    var menuEls = this.menus.map(getEl);
    while (t) {
      var n = t.tagName;
      if (n === 'INPUT' || n === 'TEXTAREA' || t === 'SELECT') return 'input';
      if (workspaceEls.indexOf(t) !== -1) return 'workspace';
      if (menuEls.indexOf(t) !== -1) return 'menu';
      t = t.parentNode;
    }
    return null;
  };

  App.prototype.menuMouseDown = function(e) {
    if (!this.menus.length) return;

    var t = e.target;
    var els = this.menus.map(getEl);
    while (t) {
      if (els.indexOf(t) === 0) return;
      t = t.parentNode;
    }

    this.hideMenus();
  };

  App.prototype.updateMouse = function(e) {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;

    var menus = this.menus;
    if (menus.length) {
      for (var i = menus.length; i--;) {
        menus[i].updateMouse(e);
      }
    }
  };

  App.prototype.drop = function() {
    if (!this.dragging) return;

    var script = this.dragScript;
    var workspace = this.dragWorkspace;
    var dragPos = this.dragPos;
    var state = this.dragState;

    document.body.removeChild(this.dragScript.el);
    this.dragScript.parent = null;
    this.dragScript.el.classList.remove('Visual-dragging');
    this.dragScript.removeShadow();
    this.feedback.style.display = 'none';

    var handled = false;
    if (this.feedbackInfo) {
      this.applyDrop(this.feedbackInfo);
      handled = true;
    } else if (this.dropWorkspace) {
      handled = true;
      if (this.dropWorkspace.isTarget) {
        this.dropWorkspace.hideFeedback();
        handled = this.dropWorkspace.drop(this.dragScript);
      } else if (!this.dropWorkspace.isPalette) {
        var pos = this.dropWorkspace.worldPosition;
        this.dropWorkspace.add(this.dragX + this.mouseX - pos.x, this.dragY + this.mouseY - pos.y, script);
      }
    }
    if (!handled && workspace && !workspace.isPalette) {
      this.dragScript.el.classList.add('Visual-dragging');
      this.dragScript.addShadow(6, 6, 8, 'rgba(0, 0, 0, .3)');
      document.body.appendChild(this.dragScript.el);

      var pos = workspace.worldPosition;
      script.slideTo(dragPos.x + pos.x, dragPos.y + pos.y, function() {
        document.body.removeChild(script.el);
        script.el.classList.remove('Visual-dragging');
        script.removeShadow();
        script.restore(state);
      }, this);
    }

    this.dragPos = null;
    this.dragState = null;
    this.dragWorkspace = null;
    this.dragScript = null;
    this.dropWorkspace = null;
    this.feedbackInfo = null;
    this.commandScript = null;
  };

  App.prototype.applyDrop = function(info) {
    switch (info.type) {
      case 'append':
        info.script.add(this.dragScript);
        return;
      case 'insert':
        info.script.insert(this.dragScript, info.block);
        return;
      case 'wrap':
        info.script.parent.add(info.script.x - this.commandScript.x, info.script.y - this.commandScript.y, this.dragScript);
        this.commandScript.value = info.script;
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
    } else if (this.dragScript.isScript) {
      this.showCommandFeedback();
    } else if (this.dragScript.isComment) {
      this.showCommentFeedback();
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
    this.commandScript = null;
    var args = this.dragScript.blocks[0].args;
    var length = args.length;
    for (var i = 0; i < length; i++) {
      if (args[i]._type === 't') {
        if (!args[i].script.blocks.length) this.commandScript = args[i];
        break;
      }
    }
    this.showFeedback(this.addScriptCommandFeedback);
  };

  App.prototype.showReporterFeedback = function() {
    this.showFeedback(this.addScriptReporterFeedback);
  };

  App.prototype.showCommentFeedback = function() {
    this.showFeedback(function() {});
  };

  App.prototype.showFeedback = function(p) {
    var workspaces = this.workspaces;
    if (this.dropWorkspace && this.dropWorkspace.isTarget) {
      this.dropWorkspace.hideFeedback();
    }
    this.dropWorkspace = null;
    for (var i = workspaces.length; i--;) {
      var ws = workspaces[i];
      var pos = ws.worldPosition;
      if (ws.el !== document.body) {
        var x = pos.x + ws.scrollX;
        var y = pos.y + ws.scrollY;
        var w = ws.width;
        var h = ws.height;
      }
      if (ws.el === document.body || this.mouseX >= x && this.mouseX < x + w && this.mouseY >= y && this.mouseY < y + h) {
        if (ws.isTarget) {
          if (!ws.acceptsDropOf(this.dragScript)) continue;
          ws.showFeedback(this.dragScript);
        }
        this.dropWorkspace = ws;
        if (ws.isPalette || ws.isTarget) return;

        var scripts = ws.scripts;
        var l = scripts.length;
        for (var j = 0; j < l; j++) {
          p.call(this, pos.x, pos.y, scripts[j]);
        }
        return;
      }
    }
  };

  App.prototype.addScriptCommandFeedback = function(x, y, script) {
    if (!script.isScript) return;
    x += script.x;
    y += script.y;
    if (!script.hasFinal && !script.isReporter && !this.commandHasHat) {
      this.addFeedback({
        x: x,
        y: y + script.height,
        feedbackY: y + script.height,
        rangeX: this.commandFeedbackRange,
        rangeY: this.feedbackRange,
        type: 'append',
        script: script
      });
    }
    if (this.commandScript && script.parent.isWorkspace && !script.hasHat && !script.isReporter) {
      this.addFeedback({
        x: x,
        y: y - this.commandScript.y,
        feedbackY: y,
        rangeX: this.commandFeedbackRange,
        rangeY: this.feedbackRange,
        type: 'wrap',
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
      } else if (a._type === 't' && !this.commandHasHat) {
        this.addScriptCommandFeedback(x + a.x, y + a.y, a.script);
      }
    }
    if (isTop && block.isHat || !isTop && this.commandHasHat || this.commandHasFinal || block.isReporter) return;
    this.addFeedback({
      x: x,
      y: isTop && block.parent.parent.isWorkspace ? y - this.dragScript.height : y,
      feedbackY: y,
      rangeX: this.commandFeedbackRange,
      rangeY: this.feedbackRange,
      type: 'insert',
      script: block.parent,
      block: block
    });
  };

  App.prototype.addScriptReporterFeedback = function(x, y, script) {
    if (!script.isScript) return;
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

    var pi = b.puzzleInset;
    var pw = b.puzzleWidth;
    var p = b.puzzle;

    switch (info.type) {
      case 'wrap':
        setTransform(canvas, 'translate('+(info.x - r)+'px, '+(info.feedbackY - r)+'px)');
        var w = b.ownWidth - this.commandScript.x + l;
        var h = info.script.height + l;
        canvas.width = w;
        canvas.height = h + p;

        context.lineWidth = l;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.strokeStyle = '#fff';
        context.moveTo(w - r, r);
        context.lineTo(pi + pw + p * 2 + r, r);
        context.lineTo(pi + pw + p + r, r + p);
        context.lineTo(pi + p + r, r + p);
        context.lineTo(pi + r, r);
        context.lineTo(r, r);
        context.lineTo(r, h - r);
        // context.lineTo(pi + r, h - r)
        // context.lineTo(pi + p + r, h - r + p);
        // context.lineTo(pi + pw + p + r, h - r + p);
        // context.lineTo(pi + pw + p * 2 + r, h - r);
        context.lineTo(w - r, h - r);
        context.stroke();
        break;
      case 'insert':
      case 'append':
        setTransform(canvas, 'translate('+(info.x - r)+'px, '+(info.feedbackY - r)+'px)');
        canvas.width = b.ownWidth + l;
        canvas.height = l + p;
        context.lineWidth = l;
        context.lineCap = 'round';
        context.lineJoin = 'round';
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
        context.lineJoin = 'round';
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
    this.el = el('Visual-menu Visual-no-select');

    this.selectedIndex = -1;
    this.items = [];
    this.els = [];

    items = [].slice.call(arguments);
    if (typeof items[0] === 'function') {
      this.action = items.shift();
    }
    this.addAll(items);

    this.ignoreMouse = true;
    this.el.addEventListener('mouseup', this.mouseUp.bind(this), true);
  }

  Menu.line = {};

  Menu.prototype.isMenu = true;

  Menu.prototype.parent = null;
  Menu.prototype.x = 0;
  Menu.prototype.y = 0;

  Menu.prototype.padding = 4;

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
      if (this.items.length && this.items[this.items.length - 1] !== Menu.line) {
        var s = el('Visual-menu-line');
        this.items.push(item);
        this.els.push(s);
        this.el.appendChild(s);
      }
    } else if (item) {
      if (typeof item !== 'object') item = [item, item];
      var i = el('Visual-menu-item');
      i.textContent = item[0];
      i.dataset.index = this.items.length;
      this.items.push(item);
      this.els.push(i);
      this.el.appendChild(i);
    }
    return this;
  };

  Menu.prototype.addTranslated = function(text) {
    var item = [options.getText(text), text];
    item.translated = true;
    return this.add(item);
  };

  Menu.prototype.addAll = function(items) {
    var length = items.length;
    for (var i = 0; i < length; i++) {
      this.add(items[i]);
    }
    return this;
  };

  Menu.prototype.translate = function() {
    var els = this.els;
    var items = this.items;
    for (var i = items.length; i--;) {
      var item = items[i];
      if (item !== Menu.line && !item.translated) {
        item.translated = true;
        els[i].textContent = item[0] = options.getText(item[0]);
      }
    }
    return this;
  };

  Menu.prototype.show = function(app) {
    this.showAt(app.mouseX, app.mouseY, app);
  };

  Menu.prototype.showAt = function(x, y, app) {
    var p = this.padding;
    app.add(this);
    var w = this.el.offsetWidth;
    var h = this.el.offsetHeight;
    this.el.style.width = (w+16)+'px';
    this.el.style.height = h+'px';
    this.el.style.maxWidth = (window.innerWidth - p * 2)+'px';
    this.el.style.maxHeight = (window.innerHeight - p * 2)+'px';
    this.moveTo(Math.max(p, Math.min(window.innerWidth - w - p, x)), Math.max(p, Math.min(window.innerHeight - h - p, y)));
  };

  Menu.prototype.updateMouse = function(e) {
    if (this.ignoreMouse) {
      this.ignoreMouse = false;
      return;
    }
    var t = e.target;
    while (t) {
      if (t.parentNode === this.el && t.dataset.index) {
        this.select(t.dataset.index);
        return;
      }
      t = t.parentNode;
    }
    this.select(-1);
  };

  Menu.prototype.select = function(i) {
    if (this.selectedIndex !== -1) {
      this.els[this.selectedIndex].classList.remove('selected');
    }
    this.selectedIndex = i;
    if (i === -1) return;
    this.els[i].classList.add('selected');
  };

  Menu.prototype.mouseUp = function(e) {
    if (this.selectedIndex === -1) return;
    this.commit(this.selectedIndex);
  };

  Menu.prototype.commit = function(index) {
    this.hide();
    var item = this.items[index];
    if (typeof item[1] === 'function') {
      item[1].call(this.context);
    } else if (typeof this.action === 'function') {
      this.action.call(this.context, item.length > 1 ? item[1] : item[0], item);
    }
  };

  Menu.prototype.hide = function() {
    this.app.remove(this);
  };

  Menu.prototype.moveTo = moveTo;
  Menu.prototype.slideTo = slideTo;


  return {
    options: options,
    getCategory: options.getCategory,
    getBlock: options.getBlock,
    getMenu: options.getMenu,
    getText: options.getText,
    Block: Block,
    Label: Label,
    Icon: Icon,
    Arg: Arg,
    Script: Script,
    Comment: Comment,
    Workspace: Workspace,
    Palette: Palette,
    Target: Target,
    App: App,
    Menu: Menu
  };
}
