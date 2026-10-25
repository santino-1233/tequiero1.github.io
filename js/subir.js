/* =========================================================
   Té Quiero Pastelería - Panel para subir y borrar fotos/videos
   Storage: Cloudinary (carpeta/tag "tequiero").

   - Subir: usa un "upload preset" SIN firmar (no necesita secretos).
   - Listar: usa las listas públicas por tag (hay que habilitar
     "Resource list" en Cloudinary > Settings > Security).
   - Borrar: pide firma con API Key + API Secret. Esos datos NO van en el
     código: se escriben en la página y viven solo en memoria.
   ========================================================= */

(function () {
  "use strict";

  // ---- CONFIG: completar con los datos de tu cuenta de Cloudinary ----------
  var CONFIG = {
    cloudName: "gb6kfzeo",       // Cloudinary > Settings > Account
    uploadPreset: "Tequiero.secret", // Settings > Upload > Upload presets (unsigned)
    tag: "tequiero"                   // tag que se le pone a cada archivo
  };

  var BASE = "https://res.cloudinary.com/" + CONFIG.cloudName;
  var credenciales = { key: "", secret: "" };

  var $ = function (id) { return document.getElementById(id); };
  var configurado = CONFIG.cloudName.indexOf("TU_") !== 0 && CONFIG.uploadPreset.indexOf("TU_") !== 0;

  var dropzone = $("dropzone");
  var inputArchivos = $("inputArchivos");
  var listaSubidas = $("listaSubidas");
  var listaExistentes = $("listaExistentes");
  var estadoGaleria = $("estadoGaleria");
  var formCredenciales = $("formCredenciales");
  var estadoCredenciales = $("estadoCredenciales");

  if (!configurado) $("avisoConfig").hidden = false;

  /* ---------- Subida ---------- */

  ["dragenter", "dragover"].forEach(function (evt) {
    dropzone.addEventListener(evt, function (e) {
      e.preventDefault();
      dropzone.classList.add("is-dragover");
    });
  });
  ["dragleave", "drop"].forEach(function (evt) {
    dropzone.addEventListener(evt, function (e) {
      e.preventDefault();
      dropzone.classList.remove("is-dragover");
    });
  });
  dropzone.addEventListener("drop", function (e) {
    if (e.dataTransfer.files.length) subirArchivos(e.dataTransfer.files);
  });
  inputArchivos.addEventListener("change", function () {
    if (inputArchivos.files.length) subirArchivos(inputArchivos.files);
    inputArchivos.value = "";
  });

  function subirArchivos(archivos) {
    if (!configurado) return;
    Array.prototype.forEach.call(archivos, subirUno);
  }

  function subirUno(archivo) {
    var tarjeta = crearTarjeta(URL.createObjectURL(archivo), archivo.type.indexOf("video") === 0 ? "video" : "image");
    tarjeta.classList.add("is-subiendo");
    listaSubidas.prepend(tarjeta);

    var datos = new FormData();
    datos.append("file", archivo);
    datos.append("upload_preset", CONFIG.uploadPreset);
    datos.append("tags", CONFIG.tag);

    // "auto" acepta fotos y videos
    fetch("https://api.cloudinary.com/v1_1/" + CONFIG.cloudName + "/auto/upload", {
      method: "POST",
      body: datos
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data.secure_url) throw new Error((data.error && data.error.message) || "Error al subir");
        tarjeta.classList.remove("is-subiendo");
        tarjeta.classList.add("is-listo");
        // Cloudinary tarda unos segundos en reflejarlo en la lista
        window.setTimeout(cargarGaleria, 4000);
      })
      .catch(function (err) {
        tarjeta.classList.add("is-error");
        tarjeta.querySelector(".subir__tarjeta-estado").textContent = "Error: " + err.message;
      });
  }

  /* ---------- Tarjetas ---------- */

  function crearTarjeta(src, tipo, publicId, resourceType) {
    var tarjeta = document.createElement("div");
    tarjeta.className = "subir__tarjeta";

    var medio;
    if (tipo === "video") {
      medio = document.createElement("video");
      medio.src = src;
      medio.muted = true;
      medio.playsInline = true;
      medio.preload = "metadata";
    } else {
      medio = document.createElement("img");
      medio.src = src;
      medio.alt = "Archivo de Té Quiero";
      medio.loading = "lazy";
    }
    tarjeta.appendChild(medio);

    // Las tarjetas recién subidas muestran estado; las del listado no
    if (!publicId) {
      var estado = document.createElement("div");
      estado.className = "subir__tarjeta-estado";
      estado.textContent = "Subiendo…";
      tarjeta.appendChild(estado);
    }

    if (publicId) {
      var borrar = document.createElement("button");
      borrar.type = "button";
      borrar.className = "subir__borrar-btn";
      borrar.setAttribute("aria-label", "Borrar archivo");
      borrar.title = "Borrar archivo";
      borrar.textContent = "✕";
      borrar.addEventListener("click", function () {
        borrarArchivo(publicId, resourceType, tarjeta);
      });
      tarjeta.appendChild(borrar);
    }

    return tarjeta;
  }

  /* ---------- Listado ---------- */

  function cargarGaleria() {
    if (!configurado) {
      estadoGaleria.textContent = "Configurá Cloudinary para ver los archivos.";
      return;
    }
    Promise.all([
      pedirLista("image"),
      pedirLista("video")
    ]).then(function (listas) {
      var todos = listas[0].concat(listas[1]);
      todos.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });

      listaExistentes.innerHTML = "";
      if (!todos.length) {
        estadoGaleria.textContent = "Todavía no hay archivos subidos.";
        return;
      }
      estadoGaleria.textContent = todos.length + " archivo(s) subido(s).";

      todos.forEach(function (r) {
        // Fotos: la imagen misma. Videos: miniatura (primer fotograma en JPG)
        var src = r.resource_type === "video"
          ? BASE + "/video/upload/so_0,w_400,h_400,c_fill,f_jpg/" + r.public_id + ".jpg"
          : BASE + "/image/upload/f_auto,q_auto,c_fill,w_400,h_400/" + r.public_id + "." + r.format;
        listaExistentes.appendChild(crearTarjeta(src, "image", r.public_id, r.resource_type));
      });
    }).catch(function (err) {
      estadoGaleria.textContent = "No se pudo cargar la lista. Revisá 'Resource list' en Cloudinary.";
      console.error(err);
    });
  }

  function pedirLista(tipo) {
    return fetch(BASE + "/" + tipo + "/list/" + CONFIG.tag + ".json", { cache: "no-cache" })
      .then(function (res) {
        if (!res.ok) return [];
        return res.json();
      })
      .then(function (data) {
        return (data.resources || []).map(function (r) {
          r.resource_type = tipo;
          return r;
        });
      });
  }

  /* ---------- Borrado (firmado) ---------- */

  formCredenciales.addEventListener("submit", function (e) {
    e.preventDefault();
    credenciales.key = $("apiKey").value.trim();
    credenciales.secret = $("apiSecret").value.trim();
    $("apiSecret").value = "";
    estadoCredenciales.textContent = credenciales.key && credenciales.secret
      ? "Borrado activado para esta pestaña."
      : "Completá los dos campos.";
  });

  async function sha1Hex(texto) {
    var bytes = new TextEncoder().encode(texto);
    var hash = await crypto.subtle.digest("SHA-1", bytes);
    return Array.prototype.map.call(new Uint8Array(hash), function (b) {
      return b.toString(16).padStart(2, "0");
    }).join("");
  }

  async function borrarArchivo(publicId, resourceType, tarjeta) {
    if (!credenciales.key || !credenciales.secret) {
      alert("Primero activá el borrado con la API Key y el API Secret.");
      return;
    }
    if (!confirm("¿Borrar este archivo? No se puede deshacer.")) return;

    tarjeta.style.opacity = "0.4";
    var timestamp = Math.floor(Date.now() / 1000);
    var firma = await sha1Hex("public_id=" + publicId + "&timestamp=" + timestamp + credenciales.secret);

    var datos = new FormData();
    datos.append("public_id", publicId);
    datos.append("timestamp", timestamp);
    datos.append("api_key", credenciales.key);
    datos.append("signature", firma);

    try {
      var res = await fetch(
        "https://api.cloudinary.com/v1_1/" + CONFIG.cloudName + "/" + resourceType + "/destroy",
        { method: "POST", body: datos }
      );
      var data = await res.json();
      if (data.result === "ok") {
        tarjeta.remove();
      } else {
        tarjeta.style.opacity = "1";
        alert("No se pudo borrar: " + (data.result || (data.error && data.error.message) || "error"));
      }
    } catch (err) {
      tarjeta.style.opacity = "1";
      alert("Error de conexión al borrar.");
      console.error(err);
    }
  }

  cargarGaleria();
})();
