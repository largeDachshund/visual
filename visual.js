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
    d.className = className || tagName;
    return d;
  }

  function setTransform(el, transform) {
    el.style.WebkitTransform =
    el.style.MozTransform =
    el.style.MSTransform =
    el.style.OTransform =
    el.style.transform = transform;
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
    isArg: false,
    isBlock: true,
    isScript: false,
    isWorkspace: false,

    parent: null,

    blockClasses: {
      ' ': 'Visual-command Visual-puzzled Visual-block',
      'f': 'Visual-command Visual-block',
      'r': 'Visual-part Visual-block',
      'b': 'Visual-part Visual-block'
    },

    radius: 4,
    puzzle: 3,
    puzzleWidth: 10,
    puzzleInset: 12,

    drawBlockType: {
      ' ': function() {
        this.drawCommandShape(true);
      },
      'f': function() {
        this.drawCommandShape(false);
      }
    },

    drawCommandShape: function(bottom) {
      var r = this.radius;
      var p = this.puzzle;
      var pi = this.puzzleInset;
      var pw = this.puzzleWidth;
      var w = this.width;
      var h = this.height - bottom * p;
      this.context.moveTo(0, r);
      this.context.arc(r, r, r, PI, PI32, false);
      this.context.lineTo(pi, 0);
      this.context.lineTo(pi + p, p);
      this.context.lineTo(pi + pw + p, p);
      this.context.lineTo(pi + pw + p * 2, 0);
      this.context.arc(w - r, r, r, PI32, 0, false);
      this.context.arc(w - r, h - r, r, 0, PI12, false);
      if (bottom) {
        this.context.lineTo(pi + pw + p * 2, h);
        this.context.lineTo(pi + pw + p, h + p);
        this.context.lineTo(pi + p, h + p);
        this.context.lineTo(pi, h);
      }
      this.context.arc(r, h - r, r, PI12, PI, false);
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
      var w = this.width = bb.width;
      var h = this.height = bb.height;

      this.draw();
    },

    draw: function() {
      var w = this.width;
      var h = this.height;

      this.canvas.width = w;
      this.canvas.height = h;

      this.context.beginPath();
      this.drawBlockType[this._type].call(this);
      this.context.fillStyle = '#e1a91a';
      this.context.fill();

      this.context.beginPath();
      this.context.moveTo(-3, -3);
      this.context.lineTo(-3, h+3);
      this.context.lineTo(w+3, h+3);
      this.context.lineTo(w+3, -3);
      this.context.closePath();
      this.drawBlockType[this._type].call(this);

      this.context.globalCompositeOperation = 'source-atop';

      this.context.shadowOffsetX = 1;
      this.context.shadowOffsetY = 1;
      this.context.shadowBlur = 1;
      this.context.shadowColor = 'rgba(255, 255, 255, .4)';
      this.context.fill();

      this.context.shadowOffsetX = -1;
      this.context.shadowOffsetY = -1;
      this.context.shadowBlur = 1;
      this.context.shadowColor = 'rgba(0, 0, 0, .4)';
      this.context.fill();
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
    this.el = el('Visual-part Visual-arg');
    if (typeof info === 'string') info = info.split('.');
    this.type = info[0];
    this.menu = info[1];
  }

  Arg.prototype = {
    constructor: Arg,

    isArg: true,
    isBlock: false,
    isScript: false,
    isWorkspace: false,

    parent: null,

    get workspace() {return this.parent && this.parent.workspace},

    layoutChildren: function() {},

    layout: function() {if (this.parent) this.parent.layout()}
  };


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

    add: function(x, y, s) {
      this.scripts.push(s);
      s.moveTo(x, y);
      this.el.appendChild(s.el);

      s.layoutChildren();

      return this;
    },

    get workspace() {return this}
  };


  return {
    Block: Block,
    Script: Script,
    Workspace: Workspace
  };
}
