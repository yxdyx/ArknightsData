import { Scene, Path, Label } from 'spritejs';
// pathfinding 被我手动把不需要的模块注释掉了，只有Grid和AStarFinder还在，体积从68kb变成了20kb，感动人心
import PF from 'pathfinding';

const radio = 100;
const cen = radio / 2;

const mapBlockColoc = {
  0: 'grey',
  // 1: '#ed8',
  // 2: '#fff',
  1: '#fff',
  2: '#fff',
  3: '#ed8',
  4: 'red',
  5: 'green',
};

const react = `m 0 0 h ${radio} v ${radio} h ${-radio} z`;
const mapReact = {
  d: react,
  lineCap: 'round',
};

const spwanMap = ({ map, tiles }, paper) => {
  const myMap = map.map((el, row) => el.map((i, col, arr) => {
    const key = tiles[i].tileKey;
    const crossAble = /end/.test(key) ? 5 : /start/.test(key) ? 4 : /tel/.test(key) ? 3
      : tiles[i].passableMask === 3 ? 1 : -1;
    const rc = [col, row];
    return {
      i,
      rc,
      crossAble,
      tileKey: tiles[i].tileKey
    };
  }));

  myMap.forEach((el) => el.forEach(({ rc, crossAble, i, tileKey }) => {
    const [col, row] = rc;
    const pos = [col * radio, row * radio];
    const fillColor = mapBlockColoc[crossAble];
    const mapBlock = new Path();
    const label = new Label(`${i} ${col} ${row}\n${tileKey}\nkey: ${crossAble}`);
    const labelPos = [pos[0] + cen / 2, pos[1] + cen / 2];
    label.attr({
      pos: labelPos,
      fillColor: '#707',
    });
    mapBlock.attr({
      pos,
      lineWidth: 1,
      path: mapReact,
      fillColor,
    });

    paper.layer('map').append(mapBlock);
    if (0 && process.env.NODE_ENV === 'development')
      paper.layer('map').append(label);
  }));
  return myMap;
};






class Map {
  tempRoutes = {}
  runningRoutes = new Set();
  pauseQueue
  grid
  map
  mapData
  routes
  finder
  paper
  mapRadio


  run = false
  constructor(container, radio = 100, mapData = { width: 1600, height: 900 }, routes) {
    const config = {
      viewport: ['auto', 'auto'],
      stickMode: 'width',
      resolution: [mapData.width * 100, mapData.height * 100]
    };
    this.paper = new Scene(container, config);
    this.mapRadio = radio;
    // 稍微做个判定，给以后用
    if (routes) {
      this.mapData = mapData;
      this.map = spwanMap(mapData, this.paper);
      this.routes = routes;
      const sMap = this.map.map(el => el.map(el => el.crossAble > -1 && el.crossAble < 5 ? 0 : 1));
      this.grid = new PF.Grid(sMap);
      this.finder = new PF.AStarFinder({
        allowDiagonal: true,
        dontCrossCorners: true
      });
    }
  }
  async ray(body) {
    return new Promise((resolve, reject) => {
      const { path, layer, color, time = 1000, saveTime = 0, stop } = body;
      if (stop) {
        const stopText = new Label(stop.time + 's');
        const height = this.grid.height - 1;
        const { col, row } = stop.pos;
        const fillColor = `hsl(${color}, 75%, 50%)`;
        const pos = [col * this.mapRadio, (height - row) * this.mapRadio];
        const mapBlock = new Path();
        mapBlock.attr({
          pos,
          lineWidth: 1,
          path: mapReact,
          fillColor
        });
        stopText.attr({
          pos,
          fillColor: 'rgb(255, 255, 255)',
          lineHeight: this.mapRadio,
          textAlign: 'center',
          width: this.mapRadio
        });
        layer.append(mapBlock);
        layer.append(stopText);


        resolve();
        return;
      }
      const pos = [0, 0];
      const s = new Path();
      const fullColors = [{
        offset: 0,
        color: `hsla(${color}, 100%, 50%, 0)`,
      }, {
        offset: 1,
        color: `hsla(${color}, 100%, 50%, 0)`,
      }];

      s.attr({
        pos,
        lineWidth: 6,
        path,
        linearGradients: {
          strokeColor: {
            vector: [10, 30, 180, 90],
            colors: fullColors,
          },
        },
      });

      layer.append(s);
      const len = s.getPathLength();
      let [x, y] = path.split(' ').slice(1, 3);
      let start = null;
      const auto = (timeStamp) => {
        if (!start) start = timeStamp;
        const progress = timeStamp - start + saveTime;
        if (!this.run) {
          resolve(progress);
          return;
        }

        let q = 0;
        let p = Math.min(progress / time, 1);
        if (p > 0.618) {
          q = 1 - (1 - p) / 0.382;
        }
        p = Math.min(p / 0.7, 1);

        const colors = [
          { offset: 0, color: `hsla(${color}, 100%, 50%, 0.1)` },
          { offset: q, color: `hsla(${color}, 100%, 50%, 0.2)` },
          { offset: p, color: `hsla(${color}, 100%, 50%, 1)` },
          { offset: Math.min(p + 0.06, 1), color: `hsla(${color}, 100%, 50%, 0)` },
        ];

        const linearGradients = s.attr('linearGradients');
        linearGradients.strokeColor.colors = colors;
        const [newX, newY] = s.getPointAtLength(p * len);
        linearGradients.strokeColor.vector = [x, y, newX, newY];
        s.attr({ linearGradients });


        if (progress < time) {
          requestAnimationFrame(auto);
        } else {
          resolve();
        }
      };

      requestAnimationFrame(auto);

    });
  }
  setData(mapData, routes) {
    this.routes = routes;
    this.paper.children.forEach(el => {
      this.paper.removeChild(el);
    });
    this.clearRoutes();
    this.paper.setResolution(mapData.width * this.mapRadio, mapData.height * this.mapRadio);
    this.mapData = mapData;
    this.map = spwanMap(mapData, this.paper);
  }

  loadMap() {
    this.map = spwanMap(this.mapData, this.paper);
  }


  spwanPathAlpha(path) {
    console.log(path);
    const temp = path.map((cur, index, arr) => {
      const [x, y] = cur;
      if (index === 0) return { row: y, col: x };

      const [preX, preY] = arr[index - 1];
      return { row: y - preY, col: x - preX };
    });
    const radio = this.mapRadio, cen = this.mapRadio / 2;
    console.log(temp);
    return temp.reduce((path, { row, col }, index) => {
      if (index === 0) return `m ${col * radio + cen} ${row * radio + cen}`;
      if (row === 0) return `${path} h ${col * radio} `;
      if (col === 0) return `${path} v ${row * radio} `;
      return `${path} l ${col * radio} ${row * radio}`;
    }, '');
  }

  deleteRoute(x) {
    this.runningRoutes.delete(x);
    delete this.tempRoutes[x];
  }
  addRoutes(x, color) {
    //可以接受Array或者Number
    if (Number.isInteger(x)) {
      this.runningRoutes.add(x);
      const route = this.routes.find((el, index) => x === index);
      const height = this.grid.height - 1;

      const { startPosition: startPos, endPosition: endPos, checkpoints } = route;
      const pathPoints = checkpoints.filter(el => {
        if (el.type > 1 && el.type < 6) console.log('!!!!!!!!!!!!!!!!!!!!! 这是什么鬼point', el.type, el, route);
        return el.type < 4 || el.type === 6;
      });
      const path = pathPoints.map(el => el.position);

      if (path.length === 0 || startPos.row !== path[0].row || startPos.col !== path[0].col) path.unshift(startPos);
      if (path.length === 0 || endPos.row !== path[path.length - 1].row || endPos.col !== path[path.length - 1].col) path.push(endPos);
      const tempGrid = route.motionMode !== 1 ? this.grid.clone() : new PF.Grid(this.grid.width, this.grid.height);
      tempGrid.setWalkableAt(endPos.col, height - endPos.row, true);

      const splitPath = path.reduce((res, el, index, arr) => {
        if (index + 1 === arr.length) return res;
        const { col, row } = el;
        let { col: nCol, row: nRow } = arr[index + 1];

        if (col === 0 && row === 0) return res;
        if (nCol === 0 && nRow === 0) {
          nRow = arr[index + 2].row;
          nCol = arr[index + 2].col;
          res.push({ stop: { pos: el, time: pathPoints[index].time } });
        }
        const ttGrid = tempGrid.clone();
        const path = this.finder.findPath(col, height - row, nCol, height - nRow, ttGrid);
        res.push({ path: this.spwanPathAlpha(path), time: path.length * 150 });
        return res;
      }, []);


      console.log('pos', splitPath, route, height);

      this.tempRoutes[x] = ({
        splitPath,
        index: x,
        color,
      });
    } else {
      throw Error('Just receive  Number');
    }

    if (!this.run) {
      this.run = true;
      this.loopRoutes();
    }
  }

  clearRoutes() {
    this.run = false;
    this.runningRoutes.clear();
  }
  loopRoutes() {
    const loop = () => {
      const queue = Object.values(this.tempRoutes);
      if (queue.length < 1) {
        this.run = false;
        return;
      }
      const tasks = this.pauseQueue ? this.pauseQueue : queue.map(el => ({ ...el, layer: this.paper.layer(el.index) }));

      if (this.pauseQueue) {
        // 恢复暂停之前的动画先清空保留画面
        tasks.forEach(el => {
          el.layer.remove();
          el.layer = this.paper.layer(el.index);
        });
      }

      const tasksToPromises = tasks.map(el => {
        return new Promise(async resolve => {
          const { splitPath, layer, color } = el;
          // return this.ray(el);
          console.log(splitPath);
          for (const { path, time, stop } of splitPath) {
            await this.ray({ path, layer, color, time, stop });
          }
          resolve();
        });
      });


      Promise.all(tasksToPromises)
        .then((saveTimes) => {
          console.log('complete');
          saveTimes = saveTimes.filter(el => el);
          if (saveTimes.length > 0) {
            console.log('stop quene', saveTimes);
            tasks.forEach((el, index) => {
              el.saveTime = saveTimes[index];
            });
            this.pauseQueue = tasks;
          } else {
            tasks.forEach(el => {
              el.layer.remove();
            });
            if (this.pauseQueue) this.pauseQueue = null;
          }
          loop();
          // this.run = false;
        });
    };
    loop();
  }
}

export {
  Map
};
