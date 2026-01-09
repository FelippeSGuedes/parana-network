import React, { useState, useEffect } from 'react';
import { motion } from "framer-motion";
import { 
  Cloud, Sun, CloudRain, Wind, Droplets, Thermometer,
  SunMedium, CloudLightning, Navigation
} from 'lucide-react';

// === ITEM MICRO ===
const WeatherDetail = ({ label, value, icon: Icon, color }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 4, padding: '3px 7px',
    borderRadius: 6, background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)', minWidth: 76
  }}>
    <Icon style={{ width: 10, height: 10, color }} />
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <p style={{ fontSize: 7, margin: 0, textTransform: 'uppercase', color:'rgba(255,255,255,0.35)' }}>{label}</p>
      <p style={{ fontSize: 10.5, margin: 0, fontWeight: 700, color:'#fff' }}>{value}</p>
    </div>
  </div>
);

// === PRINCIPAL ===
export default function WeatherCard({ data }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const weatherData = data || {
    city: 'Cascavel',
    temp: 29,
    condition: 'Ensolarado',
    feelsLike: 32,
    humidity: '40%',
    wind: '18 km/h',
    uvIndex: 'Alto'
  };

  const theme = {
    Ensolarado: {
      glow:'rgba(0,150,255,0.28)',
      icon:Sun,
      iconColor:'#ffd66b',
      bg:'linear-gradient(135deg, rgba(0,114,255,0.48), rgba(0,60,128,0.38))'
    },
    Nublado: {
      glow:'rgba(150,150,170,0.22)',
      icon:Cloud,
      iconColor:'#cdd2da',
      bg:'linear-gradient(135deg, rgba(70,70,85,0.48), rgba(40,40,55,0.38))'
    },
    Chuva: {
      glow:'rgba(0,145,255,0.35)',
      icon:CloudRain,
      iconColor:'#9bd1ff',
      bg:'linear-gradient(135deg, rgba(0,110,255,0.5), rgba(0,55,120,0.38))'
    },
    Tempestade: {
      glow:'rgba(0,0,40,0.45)',
      icon:CloudLightning,
      iconColor:'#dbe5ff',
      bg:'linear-gradient(135deg, rgba(10,10,25,0.55), rgba(0,0,0,0.4))'
    }
  }[weatherData.condition] || theme?.Ensolarado;

  const IconMain = theme.icon;

  return (
    /** === POSICIONAMENTO + RESPONSIVIDADE === **/
    <div style={{
      position:'fixed',
      top:'10px',
      right:'10px',
      zIndex:999999,
      pointerEvents:'none',
      fontFamily:'sans-serif'
    }}>

      {/* === Drag com Framer Motion ==== */}
      <motion.div
        drag
        dragMomentum={false}
        dragElastic={0.18}
        style={{ cursor:'grab', pointerEvents:'auto' }}
        initial={{ opacity:0, y:-12 }}
        animate={{ opacity:1, y:0 }}
        transition={{ duration:0.35, ease:"easeOut" }}
      >

        {/* === Glow === */}
        <div style={{
          position:'absolute', top:'-14px', right:'-14px', width:90, height:90,
          borderRadius:'50%', background:theme.glow, filter:'blur(28px)', opacity:0.35
        }}/>

        {/* === CARD === */}
        <div style={{
          display:'flex', alignItems:'center',
          minWidth: 260, maxWidth:'calc(100vw - 40px)',
          padding:'12px 16px',
          borderRadius:'14px',
          background: theme.bg,
          border:'1px solid rgba(255,255,255,0.18)',
          backdropFilter:'blur(12px) saturate(150%) contrast(105%)',
          WebkitBackdropFilter:'blur(12px) saturate(150%) contrast(105%)',
          boxShadow:'0 6px 22px rgba(0,0,0,0.45)'
        }}>

          {/* === ESQUERDA === */}
          <div style={{ minWidth:100, paddingRight:12, borderRight:'1px solid rgba(255,255,255,0.15)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <Navigation style={{ width:10, height:10, color:theme.iconColor }} />
              <h3 style={{ margin:0, color:'#fff', fontSize:11, fontWeight:800 }}>
                {weatherData.city}
              </h3>
            </div>

            <div style={{ marginTop:8, display:'flex', alignItems:'center', gap:8 }}>
              <IconMain style={{ width:24, height:24, color:theme.iconColor }} />
              <div>
                <span style={{ fontSize:20, fontWeight:900, color:'#fff' }}>
                  {weatherData.temp}
                </span><span style={{ color:theme.iconColor, fontSize:11 }}>°C</span>
                <div style={{ fontSize:7, color:theme.iconColor, textTransform:'uppercase' }}>
                  {weatherData.condition}
                </div>
              </div>
            </div>
          </div>

          {/* === DIREITA === */}
          <div style={{ flex:1, paddingLeft:12 }}>
            <div style={{
              display:'grid',
              gridTemplateColumns:'1fr 1fr',
              gap:4
            }}>
              <WeatherDetail label="Feels" value={`${weatherData.feelsLike}°`} icon={Thermometer} color="#ffd66b" />
              <WeatherDetail label="Humid." value={weatherData.humidity} icon={Droplets} color="#9bd1ff" />
              <WeatherDetail label="Wind" value={weatherData.wind} icon={Wind} color="#7fffd4" />
              <WeatherDetail label="UV" value={weatherData.uvIndex} icon={SunMedium} color={weatherData.temp>28?'#ff7a7a':'#ffd66b'} />
            </div>
          </div>
        </div>

      </motion.div>
    </div>
  );
}
