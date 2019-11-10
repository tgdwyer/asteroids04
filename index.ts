import { fromEvent,interval } from 'rxjs'; 
import { map,filter,flatMap,merge,scan, takeUntil } from 'rxjs/operators';

const 
  CanvasSize = 200,
  torusWrap = ({x,y}:Vec) => { 
    const s=CanvasSize, wrap = (v:number) => v < 0 ? v + s : v > s ? v - s : v;
    return new Vec(wrap(x),wrap(y))
  };
  
type Key = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'Space'
type Event = 'keydown' | 'keyup'

function asteroids() {
  class Tick { constructor(public readonly elapsed:number) {} }
  class Rotate { constructor(public readonly direction:number) {} }
  class Thrust { constructor(public readonly on:boolean) {} }
  class Shoot { constructor() {} }
  
  const keyObservable = <T>(e:Event, k:Key, result:()=>T)=>
    fromEvent<KeyboardEvent>(document,e)
        .pipe(
          filter(({code})=>code === k),
          filter(({repeat})=>!repeat),
          map(result)),
    startLeftRotate = keyObservable('keydown','ArrowLeft',()=>new Rotate(-.1)),
    startRightRotate = keyObservable('keydown','ArrowRight',()=>new Rotate(.1)),
    stopLeftRotate = keyObservable('keyup','ArrowLeft',()=>new Rotate(0)),
    stopRightRotate = keyObservable('keyup','ArrowRight',()=>new Rotate(0)),
    startThrust = keyObservable('keydown','ArrowUp', ()=>new Thrust(true)),
    stopThrust = keyObservable('keyup','ArrowUp', ()=>new Thrust(false)),
    shoot = keyObservable('keydown','Space', ()=>new Shoot())

  interface Body {
    readonly id:string,
    readonly pos:Vec, 
    readonly vel:Vec,
    readonly thrust:boolean,
    readonly angle:number,
    readonly rotation:number,
    readonly torque:number,
    readonly radius:number,
    readonly createTime:number
  }
  interface State {
    readonly time:number,
    readonly ship:Body,
    readonly bullets:ReadonlyArray<Body>,
    readonly exit:ReadonlyArray<Body>,
    readonly objCount:number
  }
  function createBullet(s:State):Body {
    const d = Vec.unitVecInDirection(s.ship.angle);
    return {
      id: `bullet${s.objCount}`,
      pos:s.ship.pos.add(d.scale(20)),
      vel:s.ship.vel.add(d.scale(-2)),
      createTime:s.time,
      thrust:false,
      angle:0,
      rotation:0,
      torque:0,
      radius:3
    }
  }
  function createShip():Body {
    return {
      id: 'ship',
      pos: new Vec(CanvasSize/2,CanvasSize/2),
      vel: Vec.Zero,
      thrust:false,
      angle:0,
      rotation:0,
      torque:0,
      radius:20,
      createTime:0
    }
  }
  const initialState:State = {
    time:0,
    ship: createShip(),
    bullets: [],
    exit: [],
    objCount: 0
  }
  const moveObj = (o:Body) => <Body>{
    ...o,
    rotation: o.rotation + o.torque,
    angle:o.angle+o.rotation,
    pos:torusWrap(o.pos.sub(o.vel)),
    vel:o.thrust?o.vel.sub(Vec.unitVecInDirection(o.angle).scale(0.05)):o.vel
  }
  const tick = (s:State,elapsed:number) => {
    const not = <T>(f:(x:T)=>boolean)=>(x:T)=>!f(x),
      expired = (b:Body)=>(elapsed - b.createTime) > 100,
      expiredBullets:Body[] = s.bullets.filter(expired),
      activeBullets = s.bullets.filter(not(expired));
    return <State>{...s, 
      ship:moveObj(s.ship), 
      bullets:activeBullets.map(moveObj), 
      exit:expiredBullets,
      time:elapsed
    }
  }
  const reduceState = (s:State, e:Rotate|Thrust|Tick|Shoot)=>
    e instanceof Rotate ? {...s,
      ship: {...s.ship,torque:e.direction}
    } :
    e instanceof Thrust ? {...s,
      ship: {...s.ship, thrust:e.on}
    } :
    e instanceof Shoot ? {...s,
      bullets: s.bullets.concat([createBullet(s)]),
      objCount: s.objCount + 1
    } : 
    tick(s,e.elapsed);
  interval(10).pipe(
    map(elapsed=>new Tick(elapsed)),
    merge(
      startLeftRotate,startRightRotate,stopLeftRotate,stopRightRotate),
    merge(startThrust,stopThrust),
    merge(shoot),
    scan(reduceState, initialState)
    ).subscribe(updateView);
  function updateView(s: State) {
    const 
      svg = document.getElementById("svgCanvas")!,
      ship = document.getElementById("ship")!,
      leftThruster = document.getElementById("leftThrust")!,
      rightThruster = document.getElementById("rightThrust")!,
      thruster = document.getElementById("thruster")!;
    ship.setAttribute('transform', `translate(${s.ship.pos.x},${s.ship.pos.y}) rotate(${s.ship.angle})`);
    if (s.ship.torque < 0) show(leftThruster);
    else if (s.ship.torque > 0) show(rightThruster);
    else {
      hide(leftThruster);
      hide(rightThruster);
    }
    if (s.ship.thrust) show(thruster);
    else hide(thruster);

    function hide(el:HTMLElement) {
      el.classList.add('hidden');
    }
    function show(el:HTMLElement) {
      el.classList.remove('hidden');
    }
    s.bullets.forEach(b=>{
      const createBulletView = ()=>{
        const v = document.createElementNS(svg.namespaceURI, "ellipse")!;
        v.setAttribute("id",b.id);
        v.classList.add("bullet")
        svg.appendChild(v)
        return v;
      }
      let v = document.getElementById(b.id) || createBulletView();
      v.setAttribute("cx",String(b.pos.x))
      v.setAttribute("cy",String(b.pos.y))
    })
    s.exit.forEach(o=>{
      const v = document.getElementById(o.id);
      if(v) svg.removeChild(v)
    })
  }
} 

//window.onload = asteroids;
setTimeout(asteroids,0)

function showKeys() {
  function showKey(k:Key) {
    const arrowKey = document.getElementById(k)!,
      o = (e:Event) => fromEvent<KeyboardEvent>(document,e).pipe(
        filter(({code})=>code === k))
    o('keydown').subscribe(e => arrowKey.classList.add("highlight"))
    o('keyup').subscribe(_=>arrowKey.classList.remove("highlight"))
  }
  showKey('ArrowLeft');
  showKey('ArrowRight');
  showKey('ArrowUp');
  showKey('Space');
}

setTimeout(showKeys, 0)

class Vec {
  constructor(public readonly x: number = 0, public readonly y: number = 0) {}
  add = (b:Vec) => new Vec(this.x + b.x, this.y + b.y)
  sub = (b:Vec) => this.add(b.scale(-1))
  len = ()=> Math.sqrt(this.x*this.x + this.y*this.y)
  scale = (s:number) => new Vec(this.x*s,this.y*s)
  ortho = ()=> new Vec(this.y,-this.x)
  rotate = (deg:number) =>
            (rad =>(
                (cos,sin,{x,y})=>new Vec(x*cos - y*sin, x*sin + y*cos)
              )(Math.cos(rad), Math.sin(rad), this)
            )(Math.PI * deg / 180)

  static unitVecInDirection = (deg: number) => new Vec(0,-1).rotate(deg)
  static Zero = new Vec();
}