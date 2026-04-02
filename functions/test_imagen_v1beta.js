async function run() {
    const res = await fetch("https://generativelanguage.googleapis.com/v1/models?key=AIzaSyAzmrl2_vOhQOhr_YUlS4EsvCriZP1OBxo");
    const data = await res.json();
    console.log(JSON.stringify(data.models.map(m=>m.name).filter(n=>n.includes('imagen'))));
}
run();