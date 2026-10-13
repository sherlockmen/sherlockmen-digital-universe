import * as THREE from './vendor/three.module.min.js';
import { LOGO_GEOMETRY, buildLogoSamples } from './particle-logos.js?v=nebula-pair-1';

export const SCULPTURE_KINDS=Object.freeze({cursor:0,blossom:1,deepseek:2,claude:3,logos:2});
export function logoPairLayout(width,height,viewHeight=10.9){
  const mobile=width<=680,margin=mobile?24:56,gap=mobile?24:Math.min(100,width*.07);
  const iconWidth=Math.max(1,Math.min(520,(width-margin*2-gap)*.5,height*.72));
  const worldWidth=iconWidth/height*viewHeight,offset=(iconWidth+gap)*.5/height*viewHeight;
  return{iconWidth,gap,size:[worldWidth,worldWidth],sizes:[[worldWidth,worldWidth/(26.634/19.6)],[worldWidth,worldWidth]],offset};
}
export function logoMotionTime(elapsed,reduced=false){return reduced?0:elapsed;}
export function logoMotionAngles(kind,time,out=[0,0,0]){
  const left=kind===2,direction=left?1:-1;
  out[0]=direction*.14*Math.sin(time*(left?.27:.23));out[1]=direction*.30*Math.sin(time*(left?.21:.19));out[2]=direction*.045*Math.sin(time*(left?.16:.17));return out;
}
export function sculptureState(name,rect,viewportHeight,reduced=false,neighbors={}){
  if(!Object.hasOwn(SCULPTURE_KINDS,name)||!rect||rect.height<=0||viewportHeight<=0)return null;
  const progress=(viewportHeight-rect.top)/(viewportHeight+rect.height);
  const enter=neighbors.beforeHeight ? .5-(neighbors.beforeHeight+rect.height)/(4*(viewportHeight+rect.height)) : 0;
  const exit=neighbors.afterHeight ? .5+(neighbors.afterHeight+rect.height)/(4*(viewportHeight+rect.height)) : .86;
  if(progress<=enter||progress>=exit)return null;
  const peak=neighbors.beforeHeight ? .44 : .36,fadeStart=neighbors.afterHeight ? .56 : .5;
  const rise=smoother((progress-enter)/(peak-enter)),fall=1-smoother((progress-fadeStart)/(exit-fadeStart));
  // Keep adjacent handoffs quiet while giving the assembled icon a wider hold.
  const strength=reduced?1:(neighbors.beforeHeight?rise*rise:rise)*(neighbors.afterHeight?fall*fall:fall);
  return{scene:name,kind:SCULPTURE_KINDS[name],scatter:1,tilt:1,strength,progress,centerY:name==='logos'?.50:SCULPTURE_KINDS[name]>1?.44:.50};
}

const inBrowser = typeof window !== 'undefined';
const canvas = inBrowser ? document.getElementById('galaxy-canvas') : null;
export const INTRO_TIMING=Object.freeze({labelDelay:.85,labelStagger:.1,labelDuration:1,convergeDuration:5.5});
export function introState(time,maxOrder=7){
  const titleEnd=INTRO_TIMING.labelDelay+maxOrder*INTRO_TIMING.labelStagger+INTRO_TIMING.labelDuration,gatherStart=titleEnd,end=gatherStart+INTRO_TIMING.convergeDuration;
  return{titleEnd,gatherStart,end,titleComplete:time>=titleEnd,assembly:clamp01((time-gatherStart)/INTRO_TIMING.convergeDuration),phase:time<titleEnd?'letters':time<end?'gather':'complete'};
}
export function introLetterProgress(time,order){return clamp01((time-INTRO_TIMING.labelDelay-order*INTRO_TIMING.labelStagger)/INTRO_TIMING.labelDuration);}
const cursorReferencePath='M9.60978 17.0223C9.24308 17.739 8.76808 18.189 8.18478 18.3723C7.60148 18.564 7.03478 18.4931 6.48478 18.1598C5.93478 17.8348 5.53061 17.314 5.27228 16.5973L0.672282 3.68478C0.497282 3.19312 0.455612 2.72645 0.547282 2.28478C0.638952 1.83478 0.838952 1.45561 1.14728 1.14728C1.45561 0.838948 1.83478 0.638949 2.28478 0.547279C2.73478 0.455619 3.20561 0.497279 3.69728 0.672279L16.6098 5.27228C17.3265 5.53062 17.8473 5.93478 18.1723 6.48478C18.5056 7.02648 18.5765 7.58898 18.3848 8.17228C18.2015 8.75558 17.7515 9.23058 17.0348 9.59728L12.1098 12.1098L9.60978 17.0223Z';
const stellarPalette=['#6DCBF4','#7AB1FE','#F87915','#FA994C','#F5F6FB'];
const coreParticleCount=96;
const flowSpeeds=[.025,.018,-.021,-.016,-.03];
const spiralDepths=[.62,-.46,.78,-.7,.42];
const spiralPaths=[
  'M128.472 2.36011C65.4727 24.3601 10.7725 93.1601 9.97246 162.36C8.97246 248.86 79.4138 262.86 87.9725 262.86C116.973 262.86 135.973 244.36 135.973 221.36C135.973 189.86 102.973 193.86 102.973 209.36',
  'M224.973 31.8602C132.473 3.86011 29.9727 75.8601 29.9727 159.86C29.9727 247.86 98.4726 259.86 126.473 247.86',
  'M126.473 215.359C124.639 222.692 117.073 237.159 101.473 236.359C89.1905 235.729 76.0585 219.995 76.4724 195.859C76.4724 165.859 100.473 142.859 132.473 142.859C171.973 142.859 213.473 171.36 213.473 231.36C213.473 276.36 170.473 328.36 85.9727 316.86',
  'M106.973 237.36C81.9727 240.36 61.4727 222.86 61.4727 184.86C61.4727 153.36 91.9727 123.36 132.473 123.36C172.973 123.36 227.973 149.86 227.973 225.36C227.973 287.36 168.473 322.36 121.473 322.36C53.4727 322.36 10.9727 264.86 2.47266 208.36',
  'M114.973 211.36C114.973 225.86 92.4727 226.86 92.4727 205.36C92.4727 183.86 109.938 175.36 127.973 175.36C146.008 175.36 174.473 195.86 174.473 230.86C174.473 264.36 148.473 281.86 133.973 287.36C119.473 292.86 81.6727 296.56 54.4727 269.36'
];
let cachedReferenceSamples;
let cachedCurveSamples,cachedShapeSamples;
const blossomPaths=[
  'M1025.52 167.475C960.586 89.5754 862.821 40 753.477 40C557.968 40 399.477 198.491 399.477 394V737.278C399.477 757.119 409.975 775.478 427.074 785.541L851.477 1035.3',
  'M1465.07 608.95C1500.07 513.764 1494.12 404.309 1439.45 309.614C1341.69 140.298 1125.19 82.2866 955.872 180.041L658.585 351.68C641.402 361.6 630.752 379.872 630.587 399.712L626.49 892.135',
  'M1302.52 1210.35C1402.45 1193.06 1494.27 1133.18 1548.94 1038.49C1646.69 869.17 1588.68 652.667 1419.36 554.912L1122.08 383.273C1104.89 373.353 1083.75 373.265 1066.48 383.042L637.982 625.706',
  'M700.415 1370.27C765.351 1448.17 863.116 1497.74 972.461 1497.74C1167.97 1497.74 1326.46 1339.25 1326.46 1143.74V800.466C1326.46 780.625 1315.96 762.266 1298.86 752.203L874.461 502.444',
  'M260.866 928.794C225.871 1023.98 231.82 1133.44 286.492 1228.13C384.247 1397.45 600.75 1455.46 770.065 1357.7L1067.35 1186.06C1084.54 1176.14 1095.19 1157.87 1095.35 1138.03L1099.45 645.61',
  'M423.42 327.396C323.488 344.682 231.672 404.562 177 499.257C79.2456 668.573 137.257 885.076 306.573 982.83L603.861 1154.47C621.043 1164.39 642.192 1164.48 659.456 1154.7L1087.96 912.037'
];
let controller;
let requestedPause = false;
if (inBrowser) window.SherlockGalaxy = {
  setPaused(value) { requestedPause = Boolean(value); controller?.setPaused(requestedPause); },
  reset() { controller?.reset(); }
};
if (canvas) {
  canvas.dataset.galaxyReady = 'false';
  try {
    controller = createField(canvas, requestedPause);
    controller.setPaused(requestedPause);
    controller.ready();
  } catch (error) { reportError(error); }
}
function reportError(error, reason = 'initialization') {
  if (canvas) canvas.dataset.galaxyReady = 'false';
  document.documentElement.dataset.heroIntro='complete';
  const title=document.getElementById('hero-title');
  if(title){title.getAnimations?.({subtree:true}).forEach(animation=>animation.cancel());title.dataset.introPhase='complete';}
  console.warn('SherlockMen particle field:', error.message || reason);
  window.dispatchEvent(new CustomEvent('galaxy-error', { detail: { reason } }));
}

function createField(canvas, initialPause) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 680px)').matches;
  const heroTitle=document.getElementById('hero-title'),letters=Array.from(document.querySelectorAll('[data-intro-letter]'));
  const maxOrder=Math.max(0,...letters.map(element=>Number(element.dataset.introLetter))),introEnd=introState(0,maxOrder).end;
  let titleAnimations=[];
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
  renderer.debug.onShaderError=(gl,program,vertex,fragment)=>{throw new Error([gl.getProgramInfoLog(program),gl.getShaderInfoLog(vertex),gl.getShaderInfoLog(fragment)].filter(Boolean).join('\n'));};
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-5, 5, 5.45, -5.45, .1, 100);
  camera.position.z = 12;
  let paused = initialPause, lost = false, frame = 0, previous = 0, elapsed = 0;
  let entryActive=!reduced.matches&&document.documentElement.dataset.heroIntroFailed!=='true',entryTime=entryActive?0:introEnd;
  let width = 0, height = 0, dirty = true, energy = 0, scrollCooldown = 0;
  let drag = null, returning = false, currentScatter = 0;
  let coreRotation=0,coreTargetRotation=0;
  const orbit = [0, 0];
  const pointer = { x: 0, y: 0, sampleX: 0, sampleY: 0, active: false, moved: false, pressed: false };
  let state = { scene: 'galaxy', scatter: 0, tilt: 0, strength: 1, centerY: .45 };
  const sections = Object.fromEntries(['home', 'particle-intro', 'particle-cursor', 'particle-blossom','particle-deepseek','particle-claude','particle-logos'].map(id => [id, document.getElementById(id)]));
  const gl = renderer.getContext();
  const referenceSamples=buildCurveSamples();
  const referenceTexture=new THREE.DataTexture(referenceSamples,512,5,THREE.RGBAFormat,THREE.FloatType);
  referenceTexture.minFilter=referenceTexture.magFilter=THREE.NearestFilter;
  referenceTexture.needsUpdate=true;
  const shapeTexture=new THREE.DataTexture(buildShapeSamples(),1024,4,THREE.RGBAFormat,THREE.FloatType);
  shapeTexture.minFilter=shapeTexture.magFilter=THREE.NearestFilter;shapeTexture.needsUpdate=true;
  const shapeTravel=new Float32Array(6);
  const uniforms = {
    uWeights: { value: new THREE.Vector4(1,0,0,0) },
    uPixelRatio: { value: 1 }, uPointLimit: { value: Math.min(gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1],320) },
    uTime: { value: 0 }, uViewSize: { value: new THREE.Vector2(10.9,10.9) },
    uBackground:{value:0},uSpiralPaths:{value:referenceTexture},uShapePaths:{value:shapeTexture},uShapeKind:{value:0},uLogoPair:{value:0},uLogoTime:{value:0},uLogoOffset:{value:0},uLogoMatrix0:{value:new THREE.Matrix4()},uLogoMatrix1:{value:new THREE.Matrix4()},uLogoColors:{value:LOGO_GEOMETRY.map(logo=>new THREE.Color(logo.color))},uRailStart:{value:.72},uTwinkleRate:{value:1},uEntry:{value:1},
    uGalaxyMatrix:{value:new THREE.Matrix4()},uCoreMatrix:{value:new THREE.Matrix4()},uGalaxyOrigin:{value:new THREE.Vector3()},uShapeMatrix:{value:new THREE.Matrix4()},uShapeOrigin:{value:new THREE.Vector3()},uShapeSize:{value:new THREE.Vector2()},uShapeTravel:{value:shapeTravel}
  };
  const material = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: `
      attribute vec3 aColor;
      attribute vec4 aStyle;
      attribute vec4 aLoop;
      attribute vec4 aSeed;
      attribute vec4 aShape;
      attribute vec3 aLight;
      attribute vec3 aOffset;
      uniform vec4 uWeights;
      uniform vec2 uViewSize;
      uniform float uPixelRatio,uPointLimit,uTime,uBackground,uRailStart,uTwinkleRate,uEntry,uShapeKind,uLogoPair,uLogoTime,uLogoOffset;
      uniform vec3 uLogoColors[2];
      uniform sampler2D uSpiralPaths,uShapePaths;
      uniform mat4 uGalaxyMatrix,uCoreMatrix,uShapeMatrix,uLogoMatrix0,uLogoMatrix1;
      uniform vec3 uGalaxyOrigin,uShapeOrigin;
      uniform vec2 uShapeSize;
      uniform float uShapeTravel[6];
      varying vec3 vColor;
      varying float vOpacity,vKind,vBrightness,vDiameter,vRay;
      float density(float p){return p+.22*sin(p*6.28318530718)/6.28318530718;}
      vec3 curve(float arm,float p){
        float along=clamp(p,0.,1.)*511.,a=floor(along),b=min(a+1.,511.),y=(arm+.5)/5.;
        return mix(texture2D(uSpiralPaths,vec2((a+.5)/512.,y)).xyz,texture2D(uSpiralPaths,vec2((b+.5)/512.,y)).xyz,fract(along));
      }
      vec4 outline(float kind,float p){
        float along=clamp(p,0.,1.)*1023.,a=floor(along),b=min(a+1.,1023.),y=(kind+.5)/4.;
        return mix(texture2D(uShapePaths,vec2((a+.5)/1024.,y)),texture2D(uShapePaths,vec2((b+.5)/1024.,y)),fract(along));
      }
      float layerTravel(float arm){if(arm<.5)return uShapeTravel[0];if(arm<1.5)return uShapeTravel[1];if(arm<2.5)return uShapeTravel[2];if(arm<3.5)return uShapeTravel[3];if(arm<4.5)return uShapeTravel[4];return uShapeTravel[5];}
      float ease(float p){p=clamp(p,0.,1.);return p*p*p*(p*(p*6.-15.)+10.);}
      void main(){
        float shape=uWeights.z+uWeights.w;
        float glyphKind=uLogoPair>.5?(aSeed.w<.5?2.:3.):uShapeKind;
        float speed=aLoop.x<.5?.025:aLoop.x<1.5?.018:aLoop.x<2.5?-.021:aLoop.x<3.5?-.016:-.03;
        float progress=density(fract(aLoop.y+uTime*speed*.8));
        vec3 galaxy=position;
        if(uWeights.x>0.){
          if(aStyle.z>1.5){galaxy=(uCoreMatrix*vec4(position,1.)).xyz;}
          else{vec3 before=curve(aLoop.x,max(progress-1./511.,0.)),after=curve(aLoop.x,min(progress+1./511.,1.));vec2 tangent=normalize(after.xy-before.xy);galaxy=curve(aLoop.x,progress)+vec3(vec2(-tangent.y,tangent.x)*aLoop.z,aLoop.w);}
          galaxy=(uGalaxyMatrix*vec4(galaxy,1.)).xyz+uGalaxyOrigin;
        }
        float side=aSeed.x<.5?-1.:1.;
        float outer=side*mix(uRailStart,1.12,sqrt(fract(aSeed.x*2.)));
        float cloudX=aSeed.w>=.72?(aSeed.x-.5)*uViewSize.x*1.12:outer*uViewSize.x*.5;
        float frequency=.4+.4*aSeed.z,amount=.035+.085*aSeed.z,phase=aSeed.y*6.28318530718+2.7*aSeed.z,phaseY=aSeed.z*6.28318530718+3.1*aSeed.x;
        vec2 drift=vec2(sin(phase+uTime*frequency)-sin(phase),cos(phaseY+uTime*frequency*.73)-cos(phaseY))*amount;
        vec3 cloud=vec3(cloudX,(aSeed.y-.5)*uViewSize.y*1.12,(aSeed.z-.5)*.5);cloud.xy+=drift;
        vec3 sculpture=vec3(0.);float shapeP=0.,depthCue=1.,opacityCue=1.,logoEdge=0.;
        if(shape>0.&&uBackground<.5){
          float kind=glyphKind;
          if(kind>1.5){
            vec4 point=texture2D(uShapePaths,vec2((min(floor(clamp(aShape.x,0.,.999999)*1024.),1023.)+.5)/1024.,(kind+.5)/4.));
            shapeP=density(fract(aShape.x+layerTravel(aLoop.x)));
            float z=sin(shapeP*3.14159265359*1.35+aShape.z)*aShape.y*sin(shapeP*3.14159265359)+aLoop.w*.75+(aSeed.z-.5)*.22;
            vec2 size=uShapeSize;if(uLogoPair>.5&&kind<2.5)size.y/=1.358877551;
            float flowAngle=uLogoTime*.48+aShape.x*6.28318530718,flowRadius=point.w*(.55+.35*aSeed.z)*.5;
            vec2 flow=(vec2(cos(flowAngle),sin(flowAngle))-vec2(cos(aShape.x*6.28318530718),sin(aShape.x*6.28318530718)))*flowRadius;
            sculpture=vec3((point.xy+flow)*size,z);logoEdge=point.z;
            if(uLogoPair>.5){
              sculpture.z*=min(1.,uShapeSize.x/5.8);
              if(kind<2.5)sculpture=(uLogoMatrix0*vec4(sculpture,1.)).xyz;else sculpture=(uLogoMatrix1*vec4(sculpture,1.)).xyz;
            }
          }else{
          vec2 range=texture2D(uShapePaths,vec2((min(floor(clamp(aShape.x,0.,.999999)*1024.),1023.)+.5)/1024.,(kind+.5)/4.)).zw;
          float span=max(range.y-range.x,1./1024.);
          float local=clamp((aShape.x-range.x)/span,0.,1.);
          shapeP=density(fract(local+layerTravel(aLoop.x)/span));
          float sampleP=mix(range.x,range.y,shapeP),stepP=1./1023.;
          vec2 point=outline(kind,sampleP).xy;
          vec2 before=outline(kind,max(sampleP-stepP,range.x)).xy*uShapeSize,after=outline(kind,min(sampleP+stepP,range.y)).xy*uShapeSize;
          vec2 tangent=normalize(after-before+vec2(.0001,0.));
          float across=aLoop.z*1.1+(aSeed.x+aSeed.y-1.)*.12;
          float z=sin(shapeP*3.14159265359*1.35+aShape.z)*aShape.y*sin(shapeP*3.14159265359)+aLoop.w*.75+(aSeed.z-.5)*.22;
          sculpture=vec3(point*uShapeSize+vec2(-tangent.y,tangent.x)*across,z);
          }
          sculpture=(uShapeMatrix*vec4(sculpture,1.)).xyz;
          float frontness=smoothstep(-1.15,1.15,sculpture.z);
          depthCue=mix(.78,1.18,frontness);opacityCue=mix(.72,1.,frontness);
          if(uLogoPair>.5)sculpture.x+=(kind<2.5?-uLogoOffset:uLogoOffset);
          sculpture+=uShapeOrigin;
        }
        vec3 target=galaxy*uWeights.x+cloud*uWeights.y+sculpture*shape;
        if(uBackground>.5)target=vec3((aSeed.xy-.5)*uViewSize*1.12+drift,(aSeed.z-.5)*.5);
        if(uEntry<1.){
          float local=clamp(uEntry/(.82+.18*aSeed.y),0.,1.),smoothPull=ease(local),pull=(smoothPull+sin(smoothPull*1.57079632679))*.5;
          float angle=sin(pull*3.14159265359)*(.44+.22*aSeed.z),c=cos(angle),s=sin(angle);
          vec2 scattered=(aSeed.xy-.5)*uViewSize*1.12;
          vec3 intro=vec3(c*scattered.x-s*scattered.y,s*scattered.x+c*scattered.y,(aSeed.z-.5)*.5);
          target=mix(intro,target,pull);
        }
        gl_Position=projectionMatrix*modelViewMatrix*vec4(target,1.);gl_Position.xy+=aOffset.xy*gl_Position.w;
        float endpoint=aStyle.z>1.5?1.:smoothstep(0.,.055,progress)*(1.-smoothstep(.945,1.,progress));
        float envelope=aStyle.z>1.5?1.:mix(1.,.14+.86*pow(max(sin(progress*3.14159265359),0.),.68),.45);
        endpoint=mix(1.,endpoint,uWeights.x);envelope=mix(1.,envelope,uWeights.x);
        if(shape>0.&&uShapeKind<1.5){endpoint=mix(endpoint,smoothstep(0.,.055,shapeP)*(1.-smoothstep(.945,1.,shapeP)),shape);envelope=mix(envelope,mix(1.,.14+.86*pow(max(sin(shapeP*3.14159265359),0.),.68),.45),shape);}
        float logo=step(1.5,uShapeKind)*shape*(1.-uBackground);
        float brightKeep=mix(max(aShape.w,step(.5,fract(sin(aLoop.y*193.7+aStyle.w*417.2)*43758.5453))),1.,logo);
        float bright=smoothstep(1.35,1.65,aLight.x),suppressed=shape*bright*(1.-brightKeep);
        float intensity=1.35*(uWeights.x+uWeights.y*.18+shape)*(aStyle.z>1.5?1.22:1.);
        float brightness=aLight.x*mix(1.,depthCue,shape)*mix(1.,.42,suppressed);
        float sizeScale=mix(uWeights.x+(uWeights.y+shape)*.45,1.,shape*bright*brightKeep);
        sizeScale=mix(sizeScale,1.,logo);
        if(uBackground>.5){endpoint=1.;envelope=1.;sizeScale=mix(sqrt(.2),.45,1.-uTwinkleRate);intensity=1.35*(.18+.82*uTwinkleRate);brightness=aLight.x;}
        float twinkle=.86+.14*sin(aStyle.w+uTime*.62*aLight.y*uTwinkleRate);
        vDiameter=(.35+aStyle.x*envelope*endpoint*3.8)*sizeScale*(.97+twinkle*.03)*mix(1.,depthCue,shape)*uPixelRatio;
        gl_PointSize=clamp(max(vDiameter,4.),4.,uPointLimit);
        vColor=mix(aColor,vec3(1.),aOffset.z*.16);vOpacity=aStyle.y*endpoint*mix(1.,opacityCue,shape)*(.92+twinkle*.08);
        vec3 brand=glyphKind<2.5?uLogoColors[0]:uLogoColors[1];
        vColor=mix(vColor,mix(brand,vec3(1.),.40+.30*logoEdge+.30*step(.70,aSeed.x)),logo);
        vBrightness=brightness*intensity*twinkle*(1.+aOffset.z*.7);vRay=smoothstep(1.45,2.8,aLight.x)*mix(1.,brightKeep,shape);vKind=aStyle.z;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vOpacity;
      varying float vKind;
      varying float vBrightness;
      varying float vDiameter;
      varying float vRay;
      float pixelCoverage(float x){float a=abs(x);if(a>=2.)return 0.;if(a<1.)return 2./3.-a*a+.5*a*a*a;return pow(2.-a,3.)/6.;}
      void main() {
        vec2 pixel=(gl_PointCoord-.5)*max(vDiameter,4.);
        vec2 p=pixel*2./max(vDiameter,.001);
        float disc=pow(1.-smoothstep(.08,1.,length(p)),2.2);
        float ray=max(exp(-abs(p.y)*28.)*(1.-smoothstep(.18,1.,abs(p.x))),exp(-abs(p.x)*28.)*(1.-smoothstep(.18,1.,abs(p.y))))*.28*vRay;
        float resolved=smoothstep(2.,4.,vDiameter);
        float filtered=pixelCoverage(pixel.x)*pixelCoverage(pixel.y)*.150904*vDiameter*vDiameter;
        float alpha=mix(filtered,max(disc,ray),resolved)*vOpacity;
        if(alpha<.0001)discard;
        float white=mix(.59228,disc,resolved)*smoothstep(.9,2.8,vBrightness)*.82;
        float energy=1.-min(vColor.r,min(vColor.g,vColor.b));
        vec3 emission=mix(vColor,vec3(1.),white)*vBrightness*(1.+energy*.42);
        gl_FragColor=vec4(emission,alpha);
      }
    `
  });
  const field=buildParticleField(mobile?2:4),data=field.stars,count=data.masses.length;
  const geometry = pointGeometry(data);
  const points = new THREE.Points(geometry,material); points.frustumCulled=false;scene.add(points);
  const backgroundMaterial=material.clone(); backgroundMaterial.uniforms.uBackground.value=1;
  const backdrop=new THREE.Points(pointGeometry(field.background),backgroundMaterial); backdrop.frustumCulled=false;scene.add(backdrop);
  const glow=createGlowPipeline(renderer);
  const velocities=new Float32Array(count*2);
  const physicsBatches=[{data,geometry,velocities,background:false},{data:field.background,geometry:backdrop.geometry,velocities:new Float32Array(field.background.masses.length*2),background:true}];
  const matrix=new THREE.Matrix4();
  const sample=new Float64Array(3);
  const opticalStars=[];
  for(let i=0;i<count;i++)if(data.shape[i*4+3]>.5)opticalStars.push(i);
  opticalStars.sort((a,b)=>data.styles[b*4+2]-data.styles[a*4+2]);
  const opticalLights=opticalStars.map(()=>new THREE.Vector3()),opticalPoint=new THREE.Vector3();
  canvas.dataset.paused=String(paused);canvas.dataset.rotation='0.0000,0.0000';canvas.dataset.pointer='inactive';canvas.dataset.hitStrength='0.000';
  canvas.style.touchAction='pan-y';
  if(!canvas.hasAttribute('tabindex'))canvas.tabIndex=0;
  document.querySelectorAll('[data-particle-scene]').forEach(element=>{element.style.touchAction='pan-y';});

  function readState() {
    dirty=false;
    const h=height||innerHeight,home=sections.home?.getBoundingClientRect(),intro=sections['particle-intro']?.getBoundingClientRect();
    const previousScene=state.scene;let next=null;
    for(const name of Object.keys(SCULPTURE_KINDS)){
      const section=sections['particle-'+name];if(section?.tagName!=='SECTION')continue;
      const rect=section.getBoundingClientRect();
      const before=section.previousElementSibling,after=section.nextElementSibling;
      const neighborHeight=element=>element?.id?.startsWith('particle-')&&Object.hasOwn(SCULPTURE_KINDS,element.id.slice(9))?element.getBoundingClientRect().height:0;
      const neighbors={beforeHeight:neighborHeight(before),afterHeight:neighborHeight(after)};
      next=sculptureState(name,rect,h,reduced.matches,neighbors);if(next)break;
    }
    if(!next&&home&&(home.bottom>0||(intro&&intro.top<h&&intro.bottom>0))){
      const start=(intro?.top??home.bottom)-h*.66,end=(intro?.top??home.bottom)+(intro?.height??h)*.5-h*.5;
      const scatter=clamp01(-start/Math.max(1,end-start)),tilt=clamp01(-home.top/Math.max(1,end-home.top));
      const staticCloud=reduced.matches&&scatter>=.5;
      const coreY=width<=680?.48:.60;
      next={scene:reduced.matches?(staticCloud?'cloud':'galaxy'):scatter<.55?'galaxy':'cloud',scatter:reduced.matches?Number(staticCloud):scatter,tilt:reduced.matches?Number(staticCloud):tilt,strength:1,centerY:coreY+(.35-coreY)*tilt};
    }
    state=next||{scene:'background',scatter:1,tilt:1,strength:0,centerY:.5};
    if(home&&home.top<-2&&entryActive){entryActive=false;entryTime=introEnd;}
    if(paused||reduced.matches)currentScatter=state.scatter;
    if(previousScene!==state.scene||!canvas.dataset.scene){canvas.dataset.scene=state.scene;window.dispatchEvent(new CustomEvent('galaxy-scene-change',{detail:{scene:state.scene}}));}
  }
  const targetOrbit=[0,0],shapeRotation=new THREE.Matrix4(),rotationX=new THREE.Matrix4(),rotationY=new THREE.Matrix4(),galaxyEuler=new THREE.Euler(),coreEuler=new THREE.Euler(),logoEuler=new THREE.Euler(),logoAngles=new Float64Array(3);
  const params={weights:new Float64Array(4),time:0,view:new Float64Array(2),rail:.72,galaxyMatrix:uniforms.uGalaxyMatrix.value,coreMatrix:uniforms.uCoreMatrix.value,galaxyOrigin:new Float64Array(3),shapeMatrix:uniforms.uShapeMatrix.value,shapeOrigin:new Float64Array(3),shapeSize:new Float64Array(2),travel:shapeTravel,entry:1};
  const scratch=createPositionScratch();
  function updateTitleIntro(timeline){
    if(timeline.phase==='letters'&&entryActive&&!reduced.matches){
      if(!titleAnimations.length)titleAnimations=letters.map(element=>{
        const offset=element.dataset.introSide==='left'?-44:44;
        const animation=element.animate([{opacity:0,transform:`translateX(${offset}px)`},{opacity:1,transform:'translateX(0)'}],{duration:INTRO_TIMING.labelDuration*1000,delay:(INTRO_TIMING.labelDelay+Number(element.dataset.introLetter)*INTRO_TIMING.labelStagger)*1000,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'});
        animation.pause();return animation;
      });
      titleAnimations.forEach(animation=>{animation.currentTime=entryTime*1000;});
    }else{titleAnimations.forEach(animation=>animation.cancel());titleAnimations=[];}
    if(heroTitle)heroTitle.dataset.introPhase=timeline.phase;
    document.documentElement.dataset.heroIntro=timeline.phase;
    canvas.dataset.introPhase=timeline.phase;canvas.dataset.introTime=entryTime.toFixed(3);canvas.dataset.introTitleComplete=String(timeline.titleComplete);
    canvas.dataset.introGatherStart=timeline.gatherStart.toFixed(3);canvas.dataset.introEnd=timeline.end.toFixed(3);
  }
  function completeIntro(){entryActive=false;entryTime=introEnd;updateTitleIntro(introState(introEnd,maxOrder));}
  function configure() {
    if(entryActive&&document.documentElement.dataset.heroIntroFailed==='true')completeIntro();
    const timeline=introState(entryTime,maxOrder),assembly=entryActive&&!reduced.matches?timeline.assembly:1,weights=uniforms.uWeights.value,t=state.tilt;
    updateTitleIntro(timeline);
    const kind=SCULPTURE_KINDS[state.scene]??0;uniforms.uShapeKind.value=kind;
    const pair=state.scene==='logos',logoTime=logoMotionTime(elapsed,reduced.matches);uniforms.uLogoPair.value=Number(pair);uniforms.uLogoTime.value=logoTime;
    if(state.scene in SCULPTURE_KINDS)weights.set(0,1-state.strength,kind===1?0:state.strength,kind===1?state.strength:0);
    else weights.set(1-currentScatter,currentScatter,0,0);
    const shape=weights.z+weights.w,g=weights.x,vh=camera.top-camera.bottom;
    const flatten=-52*Math.PI/180*Math.sin(Math.min(t/.75,1)*Math.PI*.5)*(1-smoother((t-.75)/.25));
    galaxyEuler.set(flatten+orbit[1],orbit[0],0,'XYZ');
    uniforms.uGalaxyMatrix.value.makeRotationFromEuler(galaxyEuler);
    coreEuler.set(reduced.matches?0:.08*Math.sin(.22*elapsed)*g,reduced.matches?0:.14*Math.cos(.28*elapsed)*g,reduced.matches?0:coreRotation*g,'XYZ');
    uniforms.uCoreMatrix.value.makeRotationFromEuler(coreEuler);
    uniforms.uGalaxyOrigin.value.set(0,vh*(.5-state.centerY),0);
    const aspect=kind>1?LOGO_GEOMETRY[kind-2].viewBox[2]/LOGO_GEOMETRY[kind-2].viewBox[3]:kind===1?1726/1538:1,widthPx=Math.min(576,width*.88,height*(kind>1?.58:.8)*aspect),worldWidth=widthPx/height*vh;
    const pairLayout=pair?logoPairLayout(width,height,vh):null,size=pairLayout?pairLayout.size:[worldWidth,worldWidth/aspect];
    uniforms.uShapeSize.value.set(size[0],size[1]);uniforms.uLogoOffset.value=pairLayout?.offset||0;
    for(let side=0;side<2;side++){logoMotionAngles(side+2,logoTime,logoAngles);logoEuler.set(logoAngles[0],logoAngles[1],logoAngles[2],'XYZ');uniforms[side?'uLogoMatrix1':'uLogoMatrix0'].value.makeRotationFromEuler(logoEuler);}
    const sweep=reduced.matches?1:smoother((shape-.04)/.78),gate=smoother((shape-.001)/.119),pointerGate=smoother((shape-.05)/.35),entrance=reduced.matches?0:Math.sin(sweep*Math.PI),amount=paused?0:.42;
    const rx=orbit[1]*pointerGate-entrance*amount*.34*gate,ry=orbit[0]*pointerGate-(1-sweep)*amount*gate;
    shapeRotation.multiplyMatrices(rotationY.makeRotationY(ry),rotationX.makeRotationX(rx));
    uniforms.uShapeMatrix.value.copy(shapeRotation);
    uniforms.uShapeOrigin.value.set(0,vh*(.5-state.centerY),0);
    uniforms.uTime.value=elapsed;uniforms.uEntry.value=assembly;uniforms.uTwinkleRate.value=1-currentScatter;
    backgroundMaterial.uniforms.uTime.value=elapsed;backgroundMaterial.uniforms.uEntry.value=assembly;
    backgroundMaterial.uniforms.uTwinkleRate.value=1-currentScatter;backgroundMaterial.uniforms.uViewSize.value.copy(uniforms.uViewSize.value);
    params.weights.set([weights.x,weights.y,weights.z,weights.w]);params.time=elapsed;params.view.set([uniforms.uViewSize.value.x,uniforms.uViewSize.value.y]);params.rail=uniforms.uRailStart.value;
    params.galaxyOrigin.set([uniforms.uGalaxyOrigin.value.x,uniforms.uGalaxyOrigin.value.y,uniforms.uGalaxyOrigin.value.z]);params.shapeOrigin.set([uniforms.uShapeOrigin.value.x,uniforms.uShapeOrigin.value.y,uniforms.uShapeOrigin.value.z]);params.shapeSize.set(size);params.entry=assembly;params.shapeKind=kind;params.logoPair=pair;params.logoTime=logoTime;params.logoOffset=uniforms.uLogoOffset.value;params.logoMatrices=[uniforms.uLogoMatrix0.value,uniforms.uLogoMatrix1.value];
    scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    canvas.dataset.transitionProgress=(state.scene in SCULPTURE_KINDS?state.strength:currentScatter).toFixed(3);canvas.dataset.assembly=assembly.toFixed(3);canvas.dataset.shapeKind=String(kind);
    canvas.dataset.logoPair=String(pair);canvas.dataset.logoTime=logoTime.toFixed(3);if(pair){canvas.dataset.logoWidth=pairLayout.iconWidth.toFixed(1);canvas.dataset.logoGap=pairLayout.gap.toFixed(1);}
  }
  function updateOpticalLights(){
    const weights=uniforms.uWeights.value,g=weights.x,shape=weights.z+weights.w;
    params.background=false;
    for(let n=0;n<opticalStars.length;n++){
      const i=opticalStars[n];particlePosition(data,i,params,sample,scratch);
      opticalPoint.set(sample[0],sample[1],sample[2]).project(camera);
      opticalPoint.x+=data.offsets[i*3];opticalPoint.y+=data.offsets[i*3+1];
      const edge=1-cubic((Math.max(Math.abs(opticalPoint.x),Math.abs(opticalPoint.y))-.88)/.2);
      opticalLights[n].set((opticalPoint.x+1)*.5,(opticalPoint.y+1)*.5,edge*(g+shape+.1*weights.y));
    }
    glow.setLights(opticalLights);
  }
  function physics(dt) {
    if(dt<=0||(!pointer.moved&&energy<.0001))return;
    matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(points.matrixWorld);
    const m=matrix.elements,w=uniforms.uWeights.value.toArray(),aspect=camera.aspect;
    const radius=176/height;
    const moved=pointer.active&&pointer.moved&&!pointer.pressed&&performance.now()>scrollCooldown;
    const startX=pointer.sampleX*aspect,startY=pointer.sampleY,endX=pointer.x*aspect,endY=pointer.y;
    const motionX=endX-startX,motionY=endY-startY;
    let maxEnergy=0,maxHit=0;
    for(const batch of physicsBatches){
    const {data,geometry,velocities}=batch,count=data.masses.length;params.background=batch.background;
    for(let i=0;i<count;i++){
      const j=i*3,k=i*4;
      particlePosition(data,i,params,sample,scratch);
      const x=sample[0],y=sample[1],z=sample[2];
      const px=m[0]*x+m[4]*y+m[8]*z+m[12],py=m[1]*x+m[5]*y+m[9]*z+m[13];
      const distance=segmentDistance((px+data.offsets[j])*aspect,py+data.offsets[j+1],startX,startY,endX,endY);
      const hit=moved?Math.pow(1-cubic(distance/radius),2):0;
      const mass=data.masses[i];let vx=velocities[i*2],vy=velocities[i*2+1];
      if(hit>0){let ix=motionX*5.4/mass*hit,iy=motionY*5.4/mass*hit;const length=Math.hypot(ix,iy);if(length>.18){ix*=.18/length;iy*=.18/length;}vx+=ix;vy+=iy;const speed=Math.hypot(vx,vy);if(speed>.5){vx*=.5/speed;vy*=.5/speed;}}
      const damping=Math.exp(-2.3/Math.sqrt(mass)*dt),returningFactor=Math.exp(-dt);
      vx*=damping;vy*=damping;velocities[i*2]=vx;velocities[i*2+1]=vy;
      data.offsets[j]=(data.offsets[j]+vx/aspect*dt)*returningFactor;
      data.offsets[j+1]=(data.offsets[j+1]+vy*dt)*returningFactor;
      data.offsets[j+2]=Math.max(hit,data.offsets[j+2]*Math.exp(-dt*4));
      maxEnergy=Math.max(maxEnergy,Math.abs(vx)+Math.abs(vy),Math.abs(data.offsets[j])+Math.abs(data.offsets[j+1]),data.offsets[j+2]);
      maxHit=Math.max(maxHit,data.offsets[j+2]);
    }
    geometry.attributes.aOffset.needsUpdate=true;
    }
    params.background=false;energy=maxEnergy;pointer.moved=false;pointer.sampleX=pointer.x;pointer.sampleY=pointer.y;
    canvas.dataset.hitStrength=maxHit.toFixed(3);
  }
  function canMotion(){return !paused&&!reduced.matches&&!lost&&!document.hidden;}
  function needsFrames(){return canMotion()&&width>0&&height>0;}
  function schedule(force=false){if(!frame&&!lost&&!document.hidden&&(force||needsFrames()))frame=requestAnimationFrame(draw);}
  function stop(){cancelAnimationFrame(frame);frame=0;previous=0;}
  function draw(timestamp){
    frame=0;if(lost||document.hidden||width<1||height<1){previous=0;return;}
    if(dirty)readState();
    const dt=previous?Math.min((timestamp-previous)/1000,.04):1/60;previous=timestamp;
    if(canMotion()){
      elapsed+=dt;
      coreTargetRotation=fract((coreTargetRotation+dt*.288+Math.PI)/(Math.PI*2))*Math.PI*2-Math.PI;
      coreRotation=fract((coreRotation+Math.atan2(Math.sin(coreTargetRotation-coreRotation),Math.cos(coreTargetRotation-coreRotation))*(1-Math.exp(-14*dt))+Math.PI)/(Math.PI*2))*Math.PI*2-Math.PI;
      currentScatter+=(state.scatter-currentScatter)*(1-Math.exp(-dt*4));
      if(entryActive&&state.scene==='galaxy'){entryTime=Math.min(introEnd,entryTime+dt);if(entryTime>=introEnd)entryActive=false;}
      const shape=uniforms.uWeights.value.z+uniforms.uWeights.value.w,flow=smoother((shape-.08)/.42);
      for(let layer=0;layer<6;layer++)shapeTravel[layer]=fract(shapeTravel[layer]+dt*(layer===5?.022:Math.abs(flowSpeeds[layer]))*.8*flow);
      const blend=1-Math.exp(-dt*(returning?5.5:14));
      orbit[0]+=(targetOrbit[0]-orbit[0])*blend;orbit[1]+=(targetOrbit[1]-orbit[1])*blend;
      if(returning&&Math.abs(orbit[0])+Math.abs(orbit[1])<.001){orbit[0]=orbit[1]=0;returning=false;}
    }
    configure();if(canMotion())physics(dt);updateOpticalLights();glow.render(scene,camera);
    canvas.dataset.rotation=orbit[0].toFixed(4)+','+orbit[1].toFixed(4);
    if(needsFrames())schedule();else previous=0;
  }
  function renderOnce(){if(lost||width<1||height<1)return;if(dirty)readState();configure();updateOpticalLights();glow.render(scene,camera);}
  function resize(){
    const rect=canvas.getBoundingClientRect();width=Math.round(rect.width);height=Math.round(rect.height);if(width<1||height<1)return;
    const ratio=Math.min(devicePixelRatio||1,1.8),vh=width/height<.72?12.7:10.9;
    renderer.setPixelRatio(ratio);renderer.setSize(width,height,false);
    camera.aspect=width/height;camera.top=vh*.5;camera.bottom=-vh*.5;camera.left=-vh*camera.aspect*.5;camera.right=-camera.left;camera.updateProjectionMatrix();
    uniforms.uViewSize.value.set(vh*camera.aspect,vh);uniforms.uPixelRatio.value=ratio;
    uniforms.uRailStart.value=Math.min(.5*Math.min(676,Math.max(width-48,0))+48,.36*width)/(width*.5);
    backgroundMaterial.uniforms.uPixelRatio.value=ratio;
    backgroundMaterial.uniforms.uViewSize.value.copy(uniforms.uViewSize.value);
    glow.resize(width,height,ratio);
    dirty=true;renderOnce();schedule();
  }
  function ready(){if(lost)return;canvas.dataset.galaxyReady='true';window.dispatchEvent(new CustomEvent('galaxy-ready'));}
  function release(event){
    if(event&&drag&&drag.id!==event.pointerId)return;
    if(drag&&!paused&&!reduced.matches){targetOrbit[0]=targetOrbit[1]=0;returning=true;}
    drag=null;pointer.pressed=false;canvas.classList.remove('is-dragging');schedule();
  }
  function acceptsDrag(target){
    const sculpture=target.closest?.('[data-particle-scene]'),interactive=target.closest?.('a,button,input,select,textarea,summary,[contenteditable="true"]');
    if(interactive&&!sculpture)return false;
    return Boolean(sculpture||target.closest?.('#home,#particle-intro')||target===canvas);
  }
  window.addEventListener('pointerdown',event=>{
    if(event.button!==0||lost||document.querySelector('#project-dialog[open]')||!acceptsDrag(event.target))return;
    drag={id:event.pointerId,x:event.clientX,y:event.clientY};pointer.pressed=true;returning=false;canvas.classList.add('is-dragging');schedule();
  });
  window.addEventListener('pointermove',event=>{
    if(document.querySelector('#project-dialog[open]'))return;
    if(drag&&drag.id===event.pointerId){targetOrbit[0]=THREE.MathUtils.clamp(targetOrbit[0]+(event.clientX-drag.x)*.005,-Math.PI*4,Math.PI*4);targetOrbit[1]=THREE.MathUtils.clamp(targetOrbit[1]+(event.clientY-drag.y)*.005,-Math.PI*4,Math.PI*4);if(paused||reduced.matches){orbit[0]=targetOrbit[0];orbit[1]=targetOrbit[1];}drag.x=event.clientX;drag.y=event.clientY;canvas.dataset.rotation=orbit[0].toFixed(4)+','+orbit[1].toFixed(4);renderOnce();}
    if(event.pointerType==='mouse'&&canMotion()){
      const x=event.clientX/width*2-1,y=1-event.clientY/height*2;
      if(!pointer.active){pointer.sampleX=x;pointer.sampleY=y;}
      pointer.x=x;pointer.y=y;pointer.active=true;pointer.moved=true;canvas.dataset.pointer=Math.round(event.clientX)+','+Math.round(event.clientY);schedule();
    }
  },{passive:true});
  window.addEventListener('pointerup',release);window.addEventListener('pointercancel',release);
  document.addEventListener('pointerleave',()=>{pointer.active=false;canvas.dataset.pointer='inactive';release();});
  window.addEventListener('blur',()=>{pointer.active=false;release();});
  window.addEventListener('keydown',event=>{
    if(event.target!==canvas&&!event.target.closest?.('[data-particle-scene]'))return;
    returning=false;
    if(event.key==='Home')reset();
    else if(event.key==='ArrowLeft')targetOrbit[0]-=.08;
    else if(event.key==='ArrowRight')targetOrbit[0]+=.08;
    else if(event.key==='ArrowUp')targetOrbit[1]-=.08;
    else if(event.key==='ArrowDown')targetOrbit[1]+=.08;
    else return;
    targetOrbit[0]=THREE.MathUtils.clamp(targetOrbit[0],-Math.PI*4,Math.PI*4);targetOrbit[1]=THREE.MathUtils.clamp(targetOrbit[1],-Math.PI*4,Math.PI*4);if(paused||reduced.matches){orbit[0]=targetOrbit[0];orbit[1]=targetOrbit[1];}event.preventDefault();canvas.dataset.rotation=orbit[0].toFixed(4)+','+orbit[1].toFixed(4);renderOnce();schedule();
  });
  function reset(){
    if(dirty)readState();orbit[0]=orbit[1]=targetOrbit[0]=targetOrbit[1]=0;coreRotation=coreTargetRotation=0;shapeTravel.fill(0);elapsed=0;returning=false;energy=0;
    for(const batch of physicsBatches){batch.data.offsets.fill(0);batch.velocities.fill(0);batch.geometry.attributes.aOffset.needsUpdate=true;}pointer.active=pointer.moved=false;
    canvas.dataset.rotation='0.0000,0.0000';canvas.dataset.hitStrength='0.000';canvas.dataset.pointer='inactive';
    if(state.scene==='galaxy'&&state.scatter<.01&&!reduced.matches){entryTime=0;entryActive=true;}
    renderOnce();schedule();
  }
  window.addEventListener('scroll',()=>{dirty=true;scrollCooldown=performance.now()+120;pointer.moved=false;pointer.sampleX=pointer.x;pointer.sampleY=pointer.y;schedule(true);},{passive:true});
  window.addEventListener('resize',resize);
  if('ResizeObserver'in window){
    const observer=new ResizeObserver(()=>{dirty=true;schedule(true);});
    document.querySelectorAll('main,#home,#particle-intro,#particle-cursor,#particle-blossom,#particle-deepseek,#particle-claude').forEach(element=>observer.observe(element));
    new ResizeObserver(resize).observe(canvas);
  }
  document.querySelectorAll('[data-particle-scene]').forEach(element=>{element.style.touchAction='pan-y';});
  canvas.style.touchAction='pan-y';if(!canvas.hasAttribute('tabindex'))canvas.tabIndex=0;
  document.addEventListener('visibilitychange',()=>{if(document.hidden){release();stop();}else{dirty=true;renderOnce();schedule();}});
  reduced.addEventListener('change',()=>{stop();completeIntro();dirty=true;pointer.active=pointer.moved=false;for(const batch of physicsBatches){batch.data.offsets.fill(0);batch.velocities.fill(0);batch.geometry.attributes.aOffset.needsUpdate=true;}energy=0;canvas.dataset.hitStrength='0.000';renderOnce();schedule();});
  renderer.debug.onShaderError=()=>{lost=true;completeIntro();stop();reportError(new Error('Particle shader compilation failed'),'shader');};
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;completeIntro();release();stop();reportError(new Error('The graphics context was lost'),'context-lost');});
  canvas.addEventListener('webglcontextrestored',()=>{lost=false;resize();ready();});
  resize();
  return{ready,reset,setPaused(value){paused=Boolean(value);canvas.dataset.paused=String(paused);stop();renderOnce();schedule();}};
}

export function makeTargets(count){return buildParticleField(count===2048?2:4).stars;}
export function buildParticleField(density=4){
  const coreCount=24*density,armCounts=[220,170,220,170,220].map(n=>n*density);
  const backCounts=armCounts.map(n=>Math.ceil(.12*n/.88));
  const stars=allocateSourcePoints(armCounts.reduce((a,b)=>a+b,coreCount));
  const background=allocateSourcePoints(backCounts.reduce((a,b)=>a+b,0));
  const palette=stellarPalette.map(c=>new THREE.Color(c)),curves=buildCurveSamples();
  const base=new Float64Array(3),normal=new Float64Array(3);
  let index=0,backIndex=0;
  const setColor=(data,i,seed)=>{const c=palette[seed<.36?0:seed<.52?1:seed<.64?2:seed<.74?3:4];data.colors.set([c.r,c.g,c.b],i*3);};
  for(let arm=0;arm<5;arm++){
    const random=seededRandom(0x243f6a88^((arm+1)*0x9e3779b9)),color=seededRandom(0xa4093822^((arm+1)*0x299f31d0));
    let hero=-1,largest=-Infinity;
    for(let n=0;n<armCounts[arm]+backCounts[arm];n++){
      const authored=n<armCounts[arm],data=authored?stars:background,i=authored?index++:backIndex++,j=i*3,k=i*4;
      const raw=random(),progress=densityProgress(raw),middle=Math.sin(progress*Math.PI);
      sourceCurvePoint(curves,base,arm,progress);sourceCurveNormal(curves,normal,arm,progress);
      const width=.4*(.3+.7*middle)*(.22+.78*random());
      const across=(random()+random()-1)*width,depth=(random()+random()-1)*width*.65;
      const strong=arm!==1&&arm!==3,bright=random()<(strong?.085:.055)*(.22+.78*middle);
      const scale=(bright?.85+1.25*random():.12+random()**2.4*.68)*2.05;
      const brightness=(bright?2+1.5*random():.56+.78*random())*(strong?1:.82);
      data.positions.set([base[0]+normal[0]*across,base[1]+normal[1]*across,base[2]+depth],j);
      setColor(data,i,color());
      data.styles.set([scale,.82+.16*random(),0,random()*Math.PI*2],k);
      data.light.set([brightness,.65+.7*random(),0],j);
      data.loops.set([arm,raw,across,depth],k);
      data.shape.set([0,spiralDepths[arm]*1.4,.82*arm,0],k);
      if(authored&&scale>largest){hero=i;largest=scale;}
    }
    if(hero>=0){const k=hero*4,j=hero*3,strong=arm!==1&&arm!==3;stars.styles[k]=Math.max(stars.styles[k],(strong?2.2:2.05)*2.05);stars.light[j]=Math.max(stars.light[j],strong?3.35:2.85);stars.shape[k+3]=1;setColor(stars,hero,[.08,.58,.22,.68,.44][arm]);}
  }
  const random=seededRandom(0xb7e15162),color=seededRandom(0xc0ac29b7);let hero=-1,largest=-Infinity;
  for(let n=0;n<coreCount;n++){
    const i=index++,j=i*3,k=i*4,radius=random()**2.4*.42,angle=random()*Math.PI*2,w=1-radius/.42;
    stars.positions.set([Math.cos(angle)*radius,Math.sin(angle)*radius*.72,(random()-.5)*.16],j);
    const brightness=1.2+2.8*w+.6*random(),scale=(.28+1.45*w+.45*random())*2.05*.8;
    setColor(stars,i,w>.74?.99:color());
    stars.styles.set([scale,.62+.38*w,2,random()*Math.PI*2],k);
    stars.light.set([brightness,.55+.45*random(),0],j);
    stars.loops.set([5,0,0,0],k);stars.shape.set([0,.18,2.4,0],k);
    if(brightness*scale>largest){hero=i;largest=brightness*scale;}
  }
  if(hero>=0)stars.shape[hero*4+3]=1;
  for(const data of [stars,background])for(let i=0;i<data.masses.length;i++){
    const j=i*3,k=i*4,p=data.loops[k+1],phase=data.styles[k+3],scale=data.styles[k],brightness=data.light[j];
    data.seeds.set([hash(p,phase,127.1,311.7),hash(phase,scale,269.5,183.3),hash(p,brightness,419.2,371.9),hash(data.styles[k+1],data.light[j+1],157.3,283.9)],k);
    data.shape[k]=fract(p*.754877666+phase*.159154943+scale*.117);
    data.masses[i]=.65+1.75*cubic(((.35+scale*3.8)-1)/13);
  }
  if(index!==stars.masses.length||backIndex!==background.masses.length)throw new Error('Source particle allocation is incomplete');
  for(const data of [stars,background])for(const values of Object.values(data))if(!values.every(Number.isFinite))throw new Error('Non-finite source particle data');
  return{stars,background,armCounts,backCounts,coreCount};
}
function allocateSourcePoints(count){return{positions:new Float32Array(count*3),colors:new Float32Array(count*3),styles:new Float32Array(count*4),light:new Float32Array(count*3),loops:new Float32Array(count*4),seeds:new Float32Array(count*4),shape:new Float32Array(count*4),offsets:new Float32Array(count*3),masses:new Float32Array(count)};}
function hash(a,b,x,y){return fract(Math.sin(a*x+b*y)*43758.5453);}
export function densityProgress(p){return p+.22*Math.sin(p*Math.PI*2)/(Math.PI*2);}
export function buildCurveSamples(){
  if(cachedCurveSamples)return cachedCurveSamples;
  const original=buildReferenceSamples(),table=new Float32Array(5*512*4),sample=new Float64Array(3);
  for(let arm=0;arm<5;arm++){
    const points=[],distances=new Float64Array(641);
    for(let i=0;i<=640;i++){pathCoordinates(original,sample,arm,i/640);points.push(Array.from(sample));if(i)distances[i]=distances[i-1]+Math.hypot(...sample.map((v,a)=>v-points[i-1][a]));}
    let segment=1;const length=distances[640];
    for(let i=0;i<512;i++){const target=i/511*length;while(segment<640&&distances[segment]<target)segment++;const f=(target-distances[segment-1])/(distances[segment]-distances[segment-1]);const j=(arm*512+i)*4;for(let a=0;a<3;a++)table[j+a]=points[segment-1][a]+(points[segment][a]-points[segment-1][a])*f;table[j+3]=1;}
  }
  return cachedCurveSamples=table;
}
function sourceCurvePoint(samples,out,arm,p){
  const along=clamp01(p)*511,a=Math.floor(along),b=Math.min(a+1,511),f=along-a,j=(arm*512+a)*4,k=(arm*512+b)*4;
  for(let axis=0;axis<3;axis++)out[axis]=samples[j+axis]+(samples[k+axis]-samples[j+axis])*f;
}
function sourceCurveNormal(samples,out,arm,p){
  const lo=clamp01(p-1/511)*511,hi=clamp01(p+1/511)*511,a=Math.floor(lo),b=Math.floor(hi),j=(arm*512+a)*4,k=(arm*512+Math.min(a+1,511))*4,l=(arm*512+b)*4,m=(arm*512+Math.min(b+1,511))*4;
  const dx=samples[l]+(samples[m]-samples[l])*(hi-b)-samples[j]-(samples[k]-samples[j])*(lo-a);
  const dy=samples[l+1]+(samples[m+1]-samples[l+1])*(hi-b)-samples[j+1]-(samples[k+1]-samples[j+1])*(lo-a),length=Math.hypot(dx,dy)||1;out[0]=-dy/length;out[1]=dx/length;out[2]=0;
}
export function buildShapeSamples(){
  if(cachedShapeSamples)return cachedShapeSamples;
  const table=new Float32Array(4*1024*4);
  for(const [kind,paths]of [[cursorReferencePath],blossomPaths].entries()){
    const width=kind?1726:19,height=kind?1538:19;
    const lines=paths.map(path=>svgPolyline(path)),lengths=lines.map(line=>{const d=new Float64Array(line.length);for(let i=1;i<line.length;i++)d[i]=d[i-1]+Math.hypot(line[i][0]-line[i-1][0],line[i][1]-line[i-1][1]);return d;});
    const total=lengths.reduce((sum,d)=>sum+d[d.length-1],0);let contour=0,offset=0,segment=1;
    for(let i=0;i<1024;i++){
      const target=(i+.5)/1024*total;
      while(contour<paths.length-1&&target>offset+lengths[contour].at(-1)){offset+=lengths[contour].at(-1);contour++;segment=1;}
      const line=lines[contour],d=lengths[contour],local=target-offset;
      while(segment<line.length-1&&d[segment]<local)segment++;
      const f=(local-d[segment-1])/(d[segment]-d[segment-1]),x=line[segment-1][0]+(line[segment][0]-line[segment-1][0])*f,y=line[segment-1][1]+(line[segment][1]-line[segment-1][1])*f,j=(kind*1024+i)*4;
      table.set([x/width-.5,.5-y/height,offset/total,(offset+d.at(-1))/total],j);
    }
  }
  table.set(buildLogoSamples(),2*1024*4);
  return cachedShapeSamples=table;
}
function shapeSample(samples,out,kind,p){const along=clamp01(p)*1023,a=Math.floor(along),b=Math.min(a+1,1023),f=along-a,j=(kind*1024+a)*4,k=(kind*1024+b)*4;for(let axis=0;axis<4;axis++)out[axis]=samples[j+axis]+(samples[k+axis]-samples[j+axis])*f;}
export function createPositionScratch(){return{base:new Float64Array(3),normal:new Float64Array(3),logoSize:new Float64Array(2),shape:{point:new Float64Array(4),before:new Float64Array(4),after:new Float64Array(4)}};}
export function shapeCoordinates(data,i,kind,travel,size,out,scratch=createPositionScratch().shape,motionTime=0){
  if(kind>1){
    const k=i*4,seed=data.shape[k],samples=buildShapeSamples(),entry=(kind*1024+Math.min(Math.floor(Math.min(seed,.999999)*1024),1023))*4;
    const p=densityProgress(fract(seed+travel[data.loops[k]]));
    const phase=seed*Math.PI*2,angle=motionTime*.48+phase,radius=samples[entry+3]*(.55+.35*data.seeds[k+2])*.5;
    out[0]=(samples[entry]+(Math.cos(angle)-Math.cos(phase))*radius)*size[0];out[1]=(samples[entry+1]+(Math.sin(angle)-Math.sin(phase))*radius)*size[1];
    out[2]=Math.sin(p*Math.PI*1.35+data.shape[k+2])*data.shape[k+1]*Math.sin(p*Math.PI)+data.loops[k+3]*.75+(data.seeds[k+2]-.5)*.22;
    return p;
  }
  const k=i*4,seed=data.shape[k],samples=buildShapeSamples(),entry=(kind*1024+Math.min(Math.floor(Math.min(seed,.999999)*1024),1023))*4,start=samples[entry+2],end=samples[entry+3],span=Math.max(end-start,1/1024);
  const local=clamp01((seed-start)/span),phase=fract(local+travel[data.loops[k]]/span),p=densityProgress(phase),global=start+(end-start)*p;
  const {point,before,after}=scratch;
  shapeSample(samples,point,kind,global);shapeSample(samples,before,kind,Math.max(global-1/1023,start));shapeSample(samples,after,kind,Math.min(global+1/1023,end));
  const dx=(after[0]-before[0])*size[0]+.0001,dy=(after[1]-before[1])*size[1],length=Math.hypot(dx,dy)||1;
  const across=data.loops[k+2]*1.1+(data.seeds[k]+data.seeds[k+1]-1)*.12;
  out[0]=point[0]*size[0]-dy/length*across;out[1]=point[1]*size[1]+dx/length*across;
  out[2]=Math.sin(p*Math.PI*1.35+data.shape[k+2])*data.shape[k+1]*Math.sin(p*Math.PI)+data.loops[k+3]*.75+(data.seeds[k+2]-.5)*.22;
  return p;
}
function transformPoint(out,m){const x=out[0],y=out[1],z=out[2],e=m.elements||m;out[0]=e[0]*x+e[4]*y+e[8]*z+e[12];out[1]=e[1]*x+e[5]*y+e[9]*z+e[13];out[2]=e[2]*x+e[6]*y+e[10]*z+e[14];}
export function particlePosition(data,i,params,out,scratch=createPositionScratch()){
  const j=i*3,k=i*4,w=params.weights,time=params.time,{base,normal}=scratch,shapeScratch=scratch.shape,curves=buildCurveSamples();
  out.fill(0);
  if(w[0]>0){
    if(data.styles[k+2]>1.5){base[0]=data.positions[j];base[1]=data.positions[j+1];base[2]=data.positions[j+2];if(params.coreMatrix)transformPoint(base,params.coreMatrix);}
    else{const p=densityProgress(fract(data.loops[k+1]+time*flowSpeeds[data.loops[k]]*.8));sourceCurvePoint(curves,base,data.loops[k],p);sourceCurveNormal(curves,normal,data.loops[k],p);base[0]+=normal[0]*data.loops[k+2];base[1]+=normal[1]*data.loops[k+2];base[2]+=data.loops[k+3];}
    transformPoint(base,params.galaxyMatrix);for(let a=0;a<3;a++)out[a]+=(base[a]+params.galaxyOrigin[a])*w[0];
  }
  if(w[1]>0){
    const sx=data.seeds[k],sy=data.seeds[k+1],sz=data.seeds[k+2],side=sx<.5?-1:1,outer=side*(params.rail+(1.12-params.rail)*Math.sqrt(fract(sx*2))),center=data.seeds[k+3]>=.72;
    const frequency=.4+.4*sz,amount=.035+.085*sz,phase=sy*Math.PI*2+2.7*sz,phaseY=sz*Math.PI*2+3.1*sx;
    out[0]+=((center?(sx-.5)*params.view[0]*1.12:outer*params.view[0]*.5)+(Math.sin(phase+time*frequency)-Math.sin(phase))*amount)*w[1];
    out[1]+=((sy-.5)*params.view[1]*1.12+(Math.cos(phaseY+time*frequency*.73)-Math.cos(phaseY))*amount)*w[1];out[2]+=(sz-.5)*.5*w[1];
  }
  if(w[2]+w[3]>0){
    const side=data.seeds[k+3]<.5?0:1,kind=params.logoPair?side+2:params.shapeKind??(w[3]>0?1:0),size=scratch.logoSize;
    size[0]=params.shapeSize[0];size[1]=params.logoPair&&kind===2?params.shapeSize[1]/(26.634/19.6):params.shapeSize[1];
    shapeCoordinates(data,i,kind,params.travel,size,base,shapeScratch,params.logoTime??0);
    if(params.logoPair){base[2]*=Math.min(1,params.shapeSize[0]/5.8);if(params.logoMatrices)transformPoint(base,params.logoMatrices[side]);}
    transformPoint(base,params.shapeMatrix);if(params.logoPair)base[0]+=(side?1:-1)*params.logoOffset;
    for(let a=0;a<3;a++)out[a]+=(base[a]+params.shapeOrigin[a])*(w[2]+w[3]);
  }
  if(params.background){const sx=data.seeds[k],sy=data.seeds[k+1],sz=data.seeds[k+2],frequency=.4+.4*sz,amount=.035+.085*sz,phase=sy*Math.PI*2+2.7*sz,phaseY=sz*Math.PI*2+3.1*sx;out[0]=(sx-.5)*params.view[0]*1.12+(Math.sin(phase+time*frequency)-Math.sin(phase))*amount;out[1]=(sy-.5)*params.view[1]*1.12+(Math.cos(phaseY+time*frequency*.73)-Math.cos(phaseY))*amount;out[2]=(sz-.5)*.5;}
  if(params.entry<1){const sx=data.seeds[k],sy=data.seeds[k+1],sz=data.seeds[k+2],local=clamp01(params.entry/(.82+.18*sy)),smooth=smoother(local),pull=(smooth+Math.sin(smooth*Math.PI*.5))*.5,angle=Math.sin(pull*Math.PI)*(.44+.22*sz),c=Math.cos(angle),s=Math.sin(angle),x=(sx-.5)*params.view[0]*1.12,y=(sy-.5)*params.view[1]*1.12;out[0]=(c*x-s*y)*(1-pull)+out[0]*pull;out[1]=(s*x+c*y)*(1-pull)+out[1]*pull;out[2]=(sz-.5)*.5*(1-pull)+out[2]*pull;}
}
function spiralCoordinates(out,arm,p){
  pathCoordinates(buildReferenceSamples(),out,arm,p);
}
export function spiralPoint(arm,p){const out=[0,0,0];spiralCoordinates(out,arm,p);return out;}
function blossomCoordinates(samples,out,strand,t){
  pathCoordinates(samples,out,strand+5,t);
}
function pathCoordinates(samples,out,row,t){
  const along=clamp01(t)*1023,a=Math.floor(along),b=Math.min(a+1,1023),fraction=along-a;
  const start=(row*1024+a)*4,end=(row*1024+b)*4;
  for(let axis=0;axis<3;axis++)out[axis]=samples[start+axis]+(samples[end+axis]-samples[start+axis])*fraction;
}
export function blossomPoint(samples,strand,t){const out=[0,0,0];blossomCoordinates(samples,out,strand,t);return out;}
export function buildReferenceSamples(){
  if(cachedReferenceSamples)return cachedReferenceSamples;
  const table=new Float32Array(12*1024*4);
  for(const [row,path]of [...spiralPaths,...blossomPaths,cursorReferencePath].entries()){
    const line=svgPolyline(path),distances=new Float64Array(line.length);
    for(let i=1;i<line.length;i++)distances[i]=distances[i-1]+Math.hypot(line[i][0]-line[i-1][0],line[i][1]-line[i-1][1]);
    const length=distances[distances.length-1];let segment=1;
    if(!Number.isFinite(length)||length<=0)throw new Error('Invalid reference path length');
    for(let i=0;i<1024;i++){
      const t=i/1023,target=t*length;
      while(segment<line.length-1&&distances[segment]<target)segment++;
      const a=line[segment-1],b=line[segment],span=distances[segment]-distances[segment-1];
      const fraction=span>0?(target-distances[segment-1])/span:0;
      const x=a[0]+(b[0]-a[0])*fraction,y=a[1]+(b[1]-a[1])*fraction,j=(row*1024+i)*4;
      if(row<5){table[j]=(x-114.973)*9.7/325;table[j+1]=(211.36-y)*9.7/325;table[j+2]=Math.sin(t*Math.PI*1.35+.82*row)*spiralDepths[row]*1.4*Math.sin(t*Math.PI);}
      else if(row<11){table[j]=(x-863)*7.2/1726;table[j+1]=(769-y)*7.2/1726;table[j+2]=Math.sin(t*Math.PI*2+(row-5)*Math.PI/3)*.18;}
      else{table[j]=(x-9.5)*7.2/19;table[j+1]=(9.5-y)*7.2/19;table[j+2]=Math.sin(t*Math.PI*2)*.12;}
      table[j+3]=1;
    }
  }
  if(table.length!==12*1024*4||!table.every(Number.isFinite))throw new Error('Reference geometry allocation is incomplete');
  cachedReferenceSamples=table;return table;
}
function svgPolyline(path){
  const tokens=path.match(/[MCVLHZ]|-?(?:\d*\.)?\d+(?:e[+-]?\d+)?/gi);
  const result=[];let i=0,x=0,y=0,startX=0,startY=0,command='';
  const number=()=>{const value=Number(tokens[i++]);if(!Number.isFinite(value))throw new Error('Invalid path coordinate');return value;};
  while(i<tokens.length){
    if(/^[A-Za-z]$/.test(tokens[i]))command=tokens[i++];
    if(command==='M'){x=number();y=number();startX=x;startY=y;result.push([x,y]);command='L';}
    else if(command==='L'){x=number();y=number();result.push([x,y]);}
    else if(command==='V'){y=number();result.push([x,y]);}
    else if(command==='H'){x=number();result.push([x,y]);}
    else if(command==='Z'){x=startX;y=startY;result.push([x,y]);command='';}
    else if(command==='C'){
      const ax=x,ay=y,bx=number(),by=number(),cx=number(),cy=number(),dx=number(),dy=number();
      for(let step=1;step<=256;step++){const t=step/256,u=1-t;result.push([u*u*u*ax+3*u*u*t*bx+3*u*t*t*cx+t*t*t*dx,u*u*u*ay+3*u*u*t*by+3*u*t*t*cy+t*t*t*dy]);}
      x=dx;y=dy;
    }else throw new Error('Unsupported reference path command');
  }
  if(result.length<2)throw new Error('Reference path has no extent');return result;
}
function cursorCoordinates(out,t){
  pathCoordinates(buildReferenceSamples(),out,11,fract(t));
}
export function cursorPoint(t){const out=[0,0,0];cursorCoordinates(out,t);return out;}
export function segmentDistance(x,y,ax,ay,bx,by){
  const dx=bx-ax,dy=by-ay,length=dx*dx+dy*dy,t=length>.0000001?clamp01(((x-ax)*dx+(y-ay)*dy)/length):0;
  return Math.hypot(x-ax-t*dx,y-ay-t*dy);
}
export function smoother(value){const t=clamp01(value);return t*t*t*(t*(t*6-15)+10);}
function cubic(value){const t=clamp01(value);return t*t*(3-2*t);}
function clamp01(value){return Math.max(0,Math.min(1,value));}
function fract(value){return value-Math.floor(value);}
function seededRandom(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let n=Math.imul(seed^seed>>>15,1|seed);n^=n+Math.imul(n^n>>>7,61|n);return((n^n>>>14)>>>0)/4294967296;};}
function pointGeometry(data){
  const geometry=new THREE.BufferGeometry();
  for(const[name,values,components]of [['position',data.positions,3],['aColor',data.colors,3],['aStyle',data.styles,4],['aLoop',data.loops,4],['aSeed',data.seeds,4],['aShape',data.shape,4],['aLight',data.light,3],['aOffset',data.offsets,3]])geometry.setAttribute(name,new THREE.BufferAttribute(values,components));
  geometry.attributes.aOffset.setUsage(THREE.DynamicDrawUsage);geometry.computeBoundingSphere();return geometry;
}
export function makeBackground(count){return buildParticleField(count===274?2:4).background;}

function createGlowPipeline(renderer){
  const type=renderer.extensions.has('EXT_color_buffer_float')?THREE.HalfFloatType:THREE.UnsignedByteType;
  const target=()=>new THREE.WebGLRenderTarget(1,1,{type,depthBuffer:false,stencilBuffer:false,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
  const field=target(),luminance=target(),horizontal=target(),vertical=target();
  const down=Array.from({length:5},target),up=Array.from({length:4},target);
  const passScene=new THREE.Scene(),passCamera=new THREE.Camera();
  const vertexShader='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
  const extract=new THREE.ShaderMaterial({
    uniforms:{uSource:{value:field.texture},uTexel:{value:new THREE.Vector2()}},
    depthTest:false,depthWrite:false,toneMapped:false,vertexShader,
    fragmentShader:`
      uniform sampler2D uSource;uniform vec2 uTexel;varying vec2 vUv;
      void main(){vec2 d=uTexel*.5;vec3 c=(texture2D(uSource,vUv+d).rgb+texture2D(uSource,vUv-d).rgb+texture2D(uSource,vUv+vec2(d.x,-d.y)).rgb+texture2D(uSource,vUv+vec2(-d.x,d.y)).rgb)*.25;
        gl_FragColor=vec4(c*smoothstep(.08,.26,dot(c,vec3(.2126,.7152,.0722))),1.);}
    `
  });
  const downsample=new THREE.ShaderMaterial({
    uniforms:{uSource:{value:luminance.texture},uTexel:{value:new THREE.Vector2()}},
    depthTest:false,depthWrite:false,toneMapped:false,vertexShader,
    fragmentShader:`
      uniform sampler2D uSource;uniform vec2 uTexel;varying vec2 vUv;
      vec3 tap(vec2 offset){vec2 uv=vUv+offset*uTexel;if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))return vec3(0.);return texture2D(uSource,uv).rgb;}
      void main(){vec3 c=(tap(vec2(-1.,1.))+tap(vec2(1.,1.))+tap(vec2(-1.,-1.))+tap(vec2(1.,-1.)))*.125;
        c+=(tap(vec2(-2.,2.))+tap(vec2(0.,2.))+tap(vec2(2.,2.))+tap(vec2(-2.,0.))+tap(vec2(0.))+tap(vec2(2.,0.))+tap(vec2(-2.,-2.))+tap(vec2(0.,-2.))+tap(vec2(2.,-2.)))/18.;
        gl_FragColor=vec4(c,1.);}
    `
  });
  const upsample=new THREE.ShaderMaterial({
    uniforms:{uSource:{value:down[4].texture},uSupport:{value:down[3].texture},uTexel:{value:new THREE.Vector2()}},
    depthTest:false,depthWrite:false,toneMapped:false,vertexShader,
    fragmentShader:`
      uniform sampler2D uSource;uniform sampler2D uSupport;uniform vec2 uTexel;varying vec2 vUv;
      vec3 tap(vec2 offset){return texture2D(uSource,vUv+offset*uTexel).rgb;}
      void main(){vec3 c=tap(vec2(0.))*.25;
        c+=(tap(vec2(0.,1.))+tap(vec2(-1.,0.))+tap(vec2(1.,0.))+tap(vec2(0.,-1.)))*.125;
        c+=(tap(vec2(-1.,1.))+tap(vec2(1.,1.))+tap(vec2(-1.,-1.))+tap(vec2(1.,-1.)))*.0625;
        gl_FragColor=vec4(mix(texture2D(uSupport,vUv).rgb,c,.72),1.);}
    `
  });
  const blur=new THREE.ShaderMaterial({
    uniforms:{uSource:{value:up[0].texture},uStep:{value:new THREE.Vector2()}},
    depthTest:false,depthWrite:false,toneMapped:false,vertexShader,
    fragmentShader:`
      uniform sampler2D uSource;uniform vec2 uStep;varying vec2 vUv;
      vec3 lightAt(vec2 uv){return texture2D(uSource,uv).rgb;}
      void main(){vec3 c=lightAt(vUv)*.227027;c+=(lightAt(vUv+uStep*1.384615)+lightAt(vUv-uStep*1.384615))*.316216;c+=(lightAt(vUv+uStep*3.230769)+lightAt(vUv-uStep*3.230769))*.070270;gl_FragColor=vec4(c,1.);}
    `
  });
  const composite=new THREE.ShaderMaterial({
    uniforms:{uField:{value:field.texture},uGlow:{value:vertical.texture},uLights:{value:Array.from({length:6},()=>new THREE.Vector3(.5,.5,0))},uAspect:{value:1}},
    depthTest:false,depthWrite:false,toneMapped:true,vertexShader,
    fragmentShader:`
      uniform sampler2D uField;uniform sampler2D uGlow;uniform vec3 uLights[6];uniform float uAspect;varying vec2 vUv;
      float streak(vec2 p,float sharpness,float falloff){vec2 window=1.-smoothstep(vec2(.03485*.72),vec2(.03485),abs(p));return exp(-abs(p.y)*sharpness)*exp(-abs(p.x)*falloff)*window.x+exp(-abs(p.x)*sharpness)*exp(-abs(p.y)*falloff)*window.y;}
      void main(){gl_FragColor=vec4(texture2D(uField,vUv).rgb+texture2D(uGlow,vUv).rgb*.7,1.);
        float optical=0.;
        for(int i=0;i<6;i++){
          vec2 p=(vUv-uLights[i].xy)*vec2(uAspect,1.);float d=length(p);
          float flare=i==0?(exp(-d*d*480.)*.18+exp(-d*11.5)*.12+(streak(p,310.,7.5)+streak(p,78.,5.2)*.16)*.18):(exp(-d*d*520.)*.1+exp(-d*17.)*.055+streak(p,360.,10.)*.24)*.25;
          optical+=flare*.28*uLights[i].z;
        }
        gl_FragColor.rgb+=vec3(.956)*optical;
        float reveal=smoothstep(.025,.72,dot(gl_FragColor.rgb,vec3(.2126,.7152,.0722)));
        float grain=fract(sin(dot(floor(vUv*vec2(1536.,1024.)),vec2(127.1,311.7)))*43758.5453);
        gl_FragColor.rgb=max(vec3(0.),gl_FragColor.rgb+vec3((grain-.5)*.031)*(.18+reveal*.82));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });
  const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),blur);quad.frustumCulled=false;passScene.add(quad);
  let blurWidth=1,blurHeight=1;
  function pass(material,destination){quad.material=material;material.uniformsNeedUpdate=true;renderer.setRenderTarget(destination);renderer.render(passScene,passCamera);}
  return{
    setLights(lights){for(let i=0;i<6;i++)if(lights[i])composite.uniforms.uLights.value[i].copy(lights[i]);else composite.uniforms.uLights.value[i].z=0;},
    resize(width,height,ratio){
      composite.uniforms.uAspect.value=width/height;
      field.setSize(Math.max(1,Math.round(width*ratio)),Math.max(1,Math.round(height*ratio)));
      extract.uniforms.uTexel.value.set(1/field.width,1/field.height);
      luminance.setSize(Math.max(1,Math.round(field.width*.5)),Math.max(1,Math.round(field.height*.5)));
      blurWidth=Math.max(1,Math.round(field.width*.25));blurHeight=Math.max(1,Math.round(field.height*.25));
      horizontal.setSize(blurWidth,blurHeight);vertical.setSize(blurWidth,blurHeight);
      let w=luminance.width,h=luminance.height;
      for(let i=0;i<down.length;i++){w=Math.max(1,Math.round(w*.5));h=Math.max(1,Math.round(h*.5));down[i].setSize(w,h);if(up[i])up[i].setSize(w,h);}
    },
    render(scene,camera){
      renderer.setRenderTarget(field);renderer.render(scene,camera);
      pass(extract,luminance);
      // Reconstruct five scales before the final blur so bright stars retain separate sharp centers.
      let previous=luminance;
      for(const level of down){downsample.uniforms.uSource.value=previous.texture;downsample.uniforms.uTexel.value.set(1/previous.width,1/previous.height);pass(downsample,level);previous=level;}
      for(let i=up.length-1;i>=0;i--){upsample.uniforms.uSource.value=previous.texture;upsample.uniforms.uSupport.value=down[i].texture;upsample.uniforms.uTexel.value.set(1/previous.width,1/previous.height);pass(upsample,up[i]);previous=up[i];}
      blur.uniforms.uSource.value=previous.texture;blur.uniforms.uStep.value.set(1/blurWidth,0);pass(blur,horizontal);
      blur.uniforms.uSource.value=horizontal.texture;blur.uniforms.uStep.value.set(0,1/blurHeight);pass(blur,vertical);
      pass(composite,null);
    }
  };
}
