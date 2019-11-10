# asteroids04

[See the rest of the tutorial here.](https://tgdwyer.github.io/asteroids/)

[Edit on StackBlitz ⚡️](https://stackblitz.com/edit/asteroids04)

### Additional Objects
Things get more complicated when we start adding more objects to the canvas that all participate in the physics simulation.  Furthermore, objects like asteroids and bullets will need to be added and removed from the canvas dynamically - unlike the ship whose visual is currently defined in the `svg` and never leaves.  We'll start with bullets that can be fired with the Space key, and which expire after a set period of time:

[![Spaceship flying](AsteroidsShoot.gif)](https://stackblitz.com/edit/asteroids04?file=index.ts)

However, the basic framework above is a good basis on which to extend.  The first complication is generalising bodies that participate in the force model with their own type `Body`, separate from the `State`:
```typescript
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
    readonly rocks:ReadonlyArray<Body>,
    readonly exit:ReadonlyArray<Body>,
    readonly objCount:number
  }
```
So the `ship` is a `Body`, and we will have collections of `Body` for both `bullets` and `rocks`.  What's this `exit` thing?  Well, when we remove something from the canvas, e.g. a bullet, we'll create a new state with a copy of the `bullets` array minus the removed bullet, and we'll place that removed bullet - together with other removed `Body`s to the `exit` array.  This notifies the `updateView` function that they can be removed.

Note the `objCount`.  This counter is incremented every time we add a `Body` and gives us a way to create a unique id that can be used to match the `Body` against its corresponding view object.

Now we define functions to create objects:
```typescript
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
```
We'll add a new action type and observable for shooting with the space bar:
```typescript
  class Shoot { constructor() {} }
  const shoot = keyObservable('keydown','Space', ()=>new Shoot())
```
And now a function to move objects, same logic as before but now applicable to any `Body`:
```typescript
  const moveObj = (o:Body) => <Body>{
    ...o,
    rotation: o.rotation + o.torque,
    angle:o.angle+o.rotation,
    pos:torusWrap(o.pos.sub(o.vel)),
    vel:o.thrust?o.vel.sub(Vec.unitVecInDirection(o.angle).scale(0.05)):o.vel
  }
```
And our tick action is a little more complicated now, complicated enough to warrant its own function:
```typescript
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
```
Note that bullets have a life time (presumably they are energy balls that fizzle into space after a certain time).  When a bullet expires it is sent to `exit`.

Now adding bullets as they are fired to our state reducer:
```typescript
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
```
We merge the Shoot stream in as before:
```typescript
  interval(10).pipe(
...
    merge(shoot),
...
```
And we tack a bit on to `updateView` to draw and remove bullets:
```typescript
  function updateView(s: State) {
...
    s.bullets.forEach(b=>{
      const createBulletView = ()=>{
        const v = document.createElementNS(svg.namespaceURI, "ellipse")!;
        v.setAttribute("id",b.id);
        v.classList.add("bullet")
        svg.appendChild(v)
        return v;
      }
      const v = document.getElementById(b.id) || createBulletView();
      v.setAttribute("cx",String(b.pos.x))
      v.setAttribute("cy",String(b.pos.y))
    })
    s.exit.forEach(o=>{
      const v = document.getElementById(o.id);
      if(v) svg.removeChild(v)
    })
  }
```