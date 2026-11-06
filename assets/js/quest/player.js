/* ==========================================================================
   quest/player.js — the player character: movement, collision,
   auto-walking along a path, and the pixel-art sprite.
   ========================================================================== */

window.Quest = window.Quest || {};

(function (Q) {
  const { T } = Q.world;
  const SPEED = 78; // pixels per second
  const FOOT_W = 8; // collision box at the feet
  const FOOT_H = 5;

  const COLORS = {
    hair: "#2b1d14",
    hairLight: "#4a3324",
    skin: "#e8b88f",
    skinShade: "#cf9a72",
    eye: "#1a1a2e",
    hoodie: "#2fb5a3",
    hoodieDark: "#218a7c",
    hoodieLight: "#5fe3d0",
    pants: "#2a3050",
    shoe: "#15161d",
    bag: "#f6c453",
    bagDark: "#c99a32",
  };

  class Player {
    constructor(tileX, tileY) {
      this.x = tileX * T + T / 2; // feet position
      this.y = tileY * T + T - 3;
      this.dir = "down";
      this.moving = false;
      this.animTime = 0;
      this.path = null;
      this.onArrive = null;
    }

    get tileX() {
      return Math.floor(this.x / T);
    }

    get tileY() {
      return Math.floor(this.y / T);
    }

    /* Check the four corners of the feet box against solid tiles */
    collides(x, y) {
      const left = x - FOOT_W / 2;
      const right = x + FOOT_W / 2 - 0.01;
      const top = y - FOOT_H;
      const bottom = y - 0.01;
      const corners = [
        [left, top],
        [right, top],
        [left, bottom],
        [right, bottom],
      ];
      return corners.some(([cx, cy]) => Q.world.isSolid(Math.floor(cx / T), Math.floor(cy / T)));
    }

    walkTo(path, onArrive) {
      this.path = path && path.length ? path.slice() : null;
      this.onArrive = onArrive || null;
      if (!this.path && onArrive) onArrive();
    }

    cancelPath() {
      this.path = null;
      this.onArrive = null;
    }

    update(dt, input) {
      let dx = input.x;
      let dy = input.y;

      if (dx || dy) {
        this.cancelPath();
      } else if (this.path) {
        // follow the path tile by tile
        const next = this.path[0];
        const tx = next.x * T + T / 2;
        const ty = next.y * T + T - 3;
        const ddx = tx - this.x;
        const ddy = ty - this.y;
        const dist = Math.hypot(ddx, ddy);
        if (dist <= Math.max(1.5, SPEED * dt)) {
          this.x = tx;
          this.y = ty;
          this.path.shift();
          if (!this.path.length) {
            this.path = null;
            const cb = this.onArrive;
            this.onArrive = null;
            this.moving = false;
            if (cb) cb();
            return;
          }
          // reached a tile in the middle of the path: keep walking smoothly
          this.moving = true;
          this.animTime += dt;
          return;
        } else {
          dx = ddx / dist;
          dy = ddy / dist;
        }
      }

      this.moving = Boolean(dx || dy);
      if (!this.moving) {
        this.animTime = 0;
        return;
      }

      const len = Math.hypot(dx, dy) || 1;
      const step = SPEED * dt;
      const mx = (dx / len) * step;
      const my = (dy / len) * step;

      if (Math.abs(dx) > Math.abs(dy)) this.dir = dx > 0 ? "right" : "left";
      else this.dir = dy > 0 ? "down" : "up";

      if (this.path) {
        // the path only uses walkable tiles, so no collision checks needed
        this.x += mx;
        this.y += my;
      } else {
        // move on each axis separately so the player slides along walls
        if (!this.collides(this.x + mx, this.y)) this.x += mx;
        if (!this.collides(this.x, this.y + my)) this.y += my;
      }

      this.animTime += dt;
    }

    /* Draw the character. (ox, oy) is the camera offset. */
    draw(ctx, ox, oy) {
      const frame = this.moving ? Math.floor(this.animTime * 8) % 4 : 0;
      const bob = this.moving && frame % 2 === 1 ? 1 : 0;
      const baseX = Math.round(this.x - ox - 6);
      const baseY = Math.round(this.y - oy - 17) + bob;
      const mirror = this.dir === "left";

      const r = (x, y, w, h, color) => {
        const fx = mirror ? 12 - x - w : x;
        ctx.fillStyle = color;
        ctx.fillRect(baseX + fx, baseY + y, w, h);
      };

      // shadow
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.fillRect(Math.round(this.x - ox - 5), Math.round(this.y - oy - 1), 10, 2);
      ctx.fillRect(Math.round(this.x - ox - 4), Math.round(this.y - oy - 2), 8, 1);

      // legs (walk cycle)
      const legA = frame === 1 ? -1 : 0;
      const legB = frame === 3 ? -1 : 0;
      const C = COLORS;

      if (this.dir === "down" || this.dir === "up") {
        r(3, 13 + legA, 2, 3 - legA, C.pants);
        r(7, 13 + legB, 2, 3 - legB, C.pants);
        r(3, 16 + legA - (legA ? 0 : 0), 2, 1, C.shoe);
        r(7, 16 + legB, 2, 1, C.shoe);
      } else {
        const swing = frame === 1 ? 1 : frame === 3 ? -1 : 0;
        r(4 - swing, 13, 2, 3, C.pants);
        r(6 + swing, 13, 2, 3, C.pants);
        r(4 - swing, 16, 3, 1, C.shoe);
        r(6 + swing, 16, 3, 1, C.shoe);
      }

      if (this.dir === "down") {
        // body
        r(2, 8, 8, 5, C.hoodie);
        r(2, 12, 8, 1, C.hoodieDark);
        r(5, 8, 2, 2, C.hoodieLight);
        // arms
        const swing = this.moving ? (frame === 1 ? -1 : frame === 3 ? 1 : 0) : 0;
        r(1, 8 + swing, 1, 4, C.hoodieDark);
        r(10, 8 - swing, 1, 4, C.hoodieDark);
        r(1, 12 + swing, 1, 1, C.skin);
        r(10, 12 - swing, 1, 1, C.skin);
        // head
        r(2, 2, 8, 6, C.skin);
        r(2, 7, 8, 1, C.skinShade);
        r(1, 0, 10, 3, C.hair);
        r(2, -1, 7, 1, C.hair);
        r(1, 3, 1, 3, C.hair);
        r(10, 3, 1, 2, C.hair);
        r(3, 1, 3, 1, C.hairLight);
        r(4, 4, 1, 2, C.eye);
        r(7, 4, 1, 2, C.eye);
      } else if (this.dir === "up") {
        r(2, 8, 8, 5, C.hoodie);
        r(2, 12, 8, 1, C.hoodieDark);
        r(3, 8, 6, 4, C.bag);
        r(3, 11, 6, 1, C.bagDark);
        r(1, 8, 1, 4, C.hoodieDark);
        r(10, 8, 1, 4, C.hoodieDark);
        r(2, 2, 8, 6, C.hair);
        r(1, 0, 10, 4, C.hair);
        r(2, -1, 7, 1, C.hair);
        r(3, 1, 4, 1, C.hairLight);
        r(2, 7, 8, 1, C.skinShade);
      } else {
        // side view (right; left is mirrored)
        r(3, 8, 7, 5, C.hoodie);
        r(3, 12, 7, 1, C.hoodieDark);
        r(2, 8, 2, 4, C.bag);
        const swing = this.moving ? (frame === 1 ? 1 : frame === 3 ? -1 : 0) : 0;
        r(6 + swing, 9, 2, 3, C.hoodieDark);
        r(6 + swing, 12, 2, 1, C.skin);
        r(3, 2, 7, 6, C.skin);
        r(3, 7, 7, 1, C.skinShade);
        r(2, 0, 8, 3, C.hair);
        r(3, -1, 6, 1, C.hair);
        r(2, 3, 3, 4, C.hair);
        r(4, 1, 3, 1, C.hairLight);
        r(8, 4, 1, 2, C.eye);
        r(10, 5, 1, 1, C.skinShade);
      }
    }
  }

  Q.Player = Player;
})(window.Quest);
