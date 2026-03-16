let video;
let prevFrame;
let particles = [];
let numParticles = 2500; 
let centroideX = -5000, centroideY = -5000;
let presenciaMano = 0; 
let aceleracion = 0; 

let estadoActual = 0; 
let ultimoTiempoInteraccion = 0; 

function setup() {
  createCanvas(windowWidth, windowHeight);
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();
  prevFrame = createImage(video.width, video.height);
  
  for (let i = 0; i < numParticles; i++) {
    particles.push(new Particle());
  }
}

function draw() {
  background(0, 15, 30, 60); 

  video.loadPixels();
  prevFrame.loadPixels();

  let totalBlancos = 0;
  let sumX = 0, sumY = 0;

  for (let x = 0; x < video.width; x += 15) { 
    for (let y = 0; y < video.height; y += 15) {
      let index = (x + y * video.width) * 4;
      let d = dist(video.pixels[index], video.pixels[index+1], video.pixels[index+2], 
                   prevFrame.pixels[index], prevFrame.pixels[index+1], prevFrame.pixels[index+2]);

      if (d > 75) { 
        sumX += x; sumY += y;
        totalBlancos++;
      }
    }
  }

  if (totalBlancos > 15) {
    let crudoX = sumX / totalBlancos;
    let crudoY = sumY / totalBlancos;
    
    let nuevoX = map(crudoX, 0, video.width, width, 0); 
    let nuevoY = map(crudoY, 0, video.height, 0, height);
    
    if (centroideX === -5000) {
      centroideX = nuevoX;
      centroideY = nuevoY;
      aceleracion = 0;
    } else {
      let velActual = dist(nuevoX, nuevoY, centroideX, centroideY);
      // Bajamos a 0.1 para que no haya picos repentinos de velocidad
      aceleracion = lerp(aceleracion, velActual, 0.1); 
      centroideX = lerp(centroideX, nuevoX, 0.4); 
      centroideY = lerp(centroideY, nuevoY, 0.4); 
    }
    
    presenciaMano = 45; 
    ultimoTiempoInteraccion = millis(); 
    
    // --- CALIBRACIÓN PARA PANTALLA COMPLETA ---
    // Subimos el límite de 35 a 85. Ahora requiere un latigazo real para agitarse.
    estadoActual = (aceleracion < 85) ? 1 : 2;

  } else {
    aceleracion = lerp(aceleracion, 0, 0.1); 
    presenciaMano--;
    
    if (presenciaMano > 0) {
      estadoActual = 1; 
      ultimoTiempoInteraccion = millis(); 
    } else {
      centroideX = -5000; 
      if (millis() - ultimoTiempoInteraccion < 3000 && ultimoTiempoInteraccion > 0) {
        estadoActual = 3; 
      } else {
        estadoActual = 0; 
      }
    }
  }

  for (let p of particles) {
    p.reaccionar(centroideX, centroideY, aceleracion, estadoActual);
    p.update(centroideX, centroideY, estadoActual); 
    p.display(aceleracion, estadoActual); 
  }

  prevFrame.copy(video, 0, 0, 640, 480, 0, 0, 640, 480);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

class Particle {
  constructor() {
    this.pos = createVector(random(width), random(height));
    this.homeY = this.pos.y;
    this.vel = createVector(random(1, 3), 0);
    this.acc = createVector(0, 0);
  }

  reaccionar(cx, cy, acl, estado) {
    if (cx < 0) return;
    let d = dist(this.pos.x, this.pos.y, cx, cy);
    
    if (d < 250) {
      let vectorFuerza = createVector(this.pos.x - cx, this.pos.y - cy);
      
      if (estado === 1) {
        vectorFuerza.normalize(); 
        let fuerzaFuga = map(d, 0, 250, 5, 0); 
        vectorFuerza.mult(fuerzaFuga);
        this.acc.add(vectorFuerza);
      } else if (estado === 2) {
        vectorFuerza.rotate(HALF_PI); 
        // Actualizamos el rango de fuerza al nuevo límite (85 a 160)
        let fuerzaGiro = map(acl, 85, 160, 4, 15, true); 
        vectorFuerza.normalize();
        vectorFuerza.mult(fuerzaGiro);
        this.acc.add(vectorFuerza);
        
        let atraccion = createVector(cx - this.pos.x, cy - this.pos.y);
        atraccion.normalize();
        atraccion.mult(2.5);
        this.acc.add(atraccion);
      }
    }
  }

  update(cx, cy, estado) {
    let d = dist(this.pos.x, this.pos.y, cx, cy);
    let retornoY = 0;
    let corrienteRio = createVector(0.5, 0); 
    let limiteVelocidad = 7;
    
    if (estado === 3) {
      let multiplicadorRetorno = 0.001; 
      retornoY = (this.homeY - this.pos.y) * multiplicadorRetorno;
      corrienteRio = createVector(0.05, 0); 
      this.acc.y += 0.04; 
      this.vel.mult(0.85); 
    } else {
      let multiplicadorRetorno = (cx > 0 && d < 250) ? 0.0 : 0.04;
      retornoY = (this.homeY - this.pos.y) * multiplicadorRetorno;
      this.vel.mult(0.92);
      if (estado === 2) limiteVelocidad = 14; 
    }
    
    this.acc.y += retornoY;
    this.acc.add(corrienteRio);
    this.vel.add(this.acc);
    this.vel.limit(limiteVelocidad); 
    this.pos.add(this.vel);
    this.acc.mult(0); 

    if (this.pos.x > width) {
      this.pos.x = -10;
      this.pos.y = this.homeY; 
      this.vel.x = random(1, 3);
      this.vel.y = 0; 
    }
  }

  display(acl, estado) {
    noStroke();
    
    let r = 0, g = 150, b = 255; 

    if (estado === 2) {
      // Actualizamos el destello de luz al nuevo rango de aceleración
      let amt = map(acl, 80, 140, 0, 1, true);
      g = lerp(150, 255, amt);
      b = lerp(255, 230, amt);
    } else if (estado === 3) {
      let tiempoPasado = millis() - ultimoTiempoInteraccion;
      let amt = map(tiempoPasado, 0, 3000, 0, 1, true); 
      r = lerp(212, 0, amt);    
      g = lerp(175, 150, amt);  
      b = lerp(55, 255, amt);   
    }

    fill(r, g, b, 180); 
    ellipse(this.pos.x, this.pos.y, 2.5, 2.5);
    
    for (let i = 1; i <= 3; i++) {
      let tailPos = p5.Vector.sub(this.pos, p5.Vector.mult(this.vel, i * 0.8)); 
      let tailAlpha = map(i, 1, 3, 150, 20); 
      fill(r, g, b, tailAlpha);
      let tailSize = map(i, 1, 3, 2.0, 1.0);
      ellipse(tailPos.x, tailPos.y, tailSize, tailSize);
    }
  }
}