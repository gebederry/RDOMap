/* eslint-disable max-len */
class Pin {
  constructor(preliminary) {
    this.lat = preliminary.lat;
    this.lng = preliminary.lng;
    this.id = preliminary.id || this.generateHash(`${this.lat}_${this.lng}_${Date.now()}`);
    this.title = preliminary.title || Language.get('map.user_pins.default_title');
    this.description = preliminary.description || Language.get('map.user_pins.default_desc');
    this.icon = preliminary.icon || 'pin';
    this.color = preliminary.color || 'orange';
  }

  generateHash(str) {
    let hash = 0;

    if (str.length === 0) return hash;

    for (let i = 0, l = str.length; i < l; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return hash;
  }

  updateMarkerContent() {
    let snippet;

    if (Settings.isPinsEditingEnabled) {
      const markerIcons = ['boats', 'trains', 'campfires', 'hideouts', 'bounty', 'dynamic_bounties', 'camps', 'plants', 'fence', 'fme', 'gfh', 'random_encounters', 'animals', 'birds', 'fish', 'nazar', 'fast_travel', 'treasure', 'daily_locations', 'harrietum_animals', 'sightseeing', 'discoverables', 'singleplayer'];

      snippet = document.createElement('div');
      snippet.innerHTML = `
          <h1>
            <input id="${this.id}_name" class="marker-popup-pin-input-name" type="text" value="${this.title}"
            placeholder="${Language.get('map.user_pins.placeholder_title')}">
          </h1>
          <p>
            <textarea id="${this.id}_desc" class="marker-popup-pin-input-desc" rows="5" value="${this.description}"
            placeholder="${Language.get('map.user_pins.placeholder_desc')}">${this.description}</textarea>
          </p>
          <hr class="marker-popup-pin-input-divider">
          <div style="display: grid;">
            <label for="${this.id}_icon" class="marker-popup-pin-label" data-text="map.user_pins.icon">
              ${Language.get('map.user_pins.icon')}
            </label>
            <select id="${this.id}_icon" class="marker-popup-pin-input-icon">
              ${markerIcons.map(icon => `
                <option value="${icon}" data-text="map.user_pins.icon.${icon}"
                  ${icon === this.icon ? 'selected' : ''}>
                  ${Language.get(`map.user_pins.icon.${icon}`)}
                </option>
              `).join('')}
            </select>
            <label for="${this.id}_color" class="marker-popup-pin-label" data-text="map.user_pins.color">
              ${Language.get('map.user_pins.color')}
            </label>
            <input type="text" id="${this.id}_color" class="input-text coloris instance-userpin" readonly value="${colorNameToHexMap[this.color]}">
          </div>
          <div style="display: grid;">
            <button type="button" class="btn btn-info save-button" data-text="map.user_pins.save">
              ${Language.get('map.user_pins.save')}
            </button>
            <button type="button" class="btn btn-danger remove-button" data-text="map.user_pins.remove">
              ${Language.get('map.user_pins.remove')}
            </button>
            <small class="popupContentDebug">
              Latitude: ${this.lat} / Longitude: ${this.lng}
            </small>
          </div>
      `;

      Coloris.wrap(snippet.querySelector('.instance-userpin'));

      Coloris.setInstance('.instance-userpin', {
        theme: 'large'
      });

      snippet.querySelector('.save-button').addEventListener('click', () => this.save(
        document.getElementById(`${this.id}_name`).value,
        document.getElementById(`${this.id}_desc`).value,
        document.getElementById(`${this.id}_icon`).value,
        colorNameMap[document.getElementById(`${this.id}_color`).value]
      ));
      
      snippet.querySelector('.remove-button').addEventListener('click', () => this.remove());
    } else {
      snippet = document.createElement('div');
      snippet.innerHTML = `
        <h1 id="${this.id}_name">${this.title}</h1>
        <p id="${this.id}_desc">${this.description}</p>
      `;
    }

    return snippet;
  }

  save(title, desc, icon, color) {
    this.title = title;
    this.description = desc;
    this.icon = icon;
    this.color = color;

    Pins.layer.removeLayer(
      Object.keys(Pins.layer._layers)
        .find(marker => {
          this.lat = Pins.layer._layers[marker]._latlng.lat;
          this.lng = Pins.layer._layers[marker]._latlng.lng;
          return Pins.layer._layers[marker].options.id === this.id;
        }));

    Pins.pinsList = Pins.pinsList.filter(_pin => _pin.id !== this.id);

    Pins.addPin(JSON.parse(JSON.stringify(this)));

    Pins.save();

    MapBase.updateTippy('pins');
  }

  remove() {
    let id = this.id;
    Pins.pinsList = Pins.pinsList.filter(function (pin) {
      return pin.id !== id;
    });

    Pins.layer.removeLayer(Object.keys(Pins.layer._layers).find(marker => Pins.layer._layers[marker].options.id === this.id));

    Pins.save();
  }
}

class Pins {
  static init() {
    this.layer = L.layerGroup();

    document.getElementById('pins-place-mode').addEventListener('change', function () {
      Settings.isPinsPlacingEnabled = this.checked;
      Pins.onMap = true;
    });

    document.getElementById('pins-edit-mode').addEventListener('change', function () {
      Settings.isPinsEditingEnabled = this.checked;
      Pins.onMap = true;
      Pins.loadPins();
    });

    document.getElementById('pins-place-new').addEventListener('click', function () {
      Pins.onMap = true;
      Pins.addPinToCenter();
      Pins.save();
    });

    const removeAllPinsModal = new bootstrap.Modal(document.getElementById('remove-all-pins-modal'));
    document.getElementById('open-remove-all-pins-modal').addEventListener('click', function () {
      removeAllPinsModal.show();
    });

    document.getElementById('remove-all-pins').addEventListener('click', function () {
      Pins.removeAllPins();
    });

    document.getElementById('pins-export').addEventListener('click', function () {
      try {
        Pins.exportPins();
      } catch (error) {
        console.error(error);
        alert(Language.get('alerts.feature_not_supported'));
      }
    });

    document.getElementById('pins-import').addEventListener('click', function () {
      try {
        let file = document.getElementById('pins-import-file').files[0];
        let fallback = false;

        if (!file) {
          alert(Language.get('alerts.file_not_found'));
          return;
        }

        try {
          file.text().then((text) => {
            Pins.importPins(text);
          });
        } catch (error) {
          fallback = true;
        }

        if (fallback) {
          const reader = new FileReader();

          reader.addEventListener('loadend', (e) => {
            const text = e.target.result;
            Pins.importPins(text);
          });

          reader.readAsText(file);
        }

        MapBase.updateTippy('pins');
      } catch (error) {
        console.error(error);
        alert(Language.get('alerts.feature_not_supported'));
      }
    });

    document.getElementById('pins-place-mode').checked = Settings.isPinsPlacingEnabled;
    document.getElementById('pins-edit-mode').checked = Settings.isPinsEditingEnabled;

    this.context = document.querySelector('.menu-option[data-type=user_pins]');
    this.context.classList.toggle('disabled', !this.onMap);
    this.context.addEventListener('click', () => this.onMap = !this.onMap);
    Language.translateDom(this.context);

    this.loadPins();

    if (this.onMap)
      this.layer.addTo(MapBase.map);
  }

  static loadPins() {
    this.layer.clearLayers();
    this.pinsList = [];

    //Check if exists old pins data
    let oldPinnedItems = localStorage.getItem('pinned-items');
    if (oldPinnedItems != null) {
      oldPinnedItems.split(';').forEach(oldItem => {
        if (oldItem === '') return;
        const properties = oldItem.split(':');
        this.addPin(JSON.parse(`{"lat": ${properties[0]}, "lng": ${properties[1]}, "id": ${properties[2]}, "title": "${properties[3]}", "description": "${properties[4]}", "icon": "${properties[5]}", "color": "red"}`));
      });
    }

    if (Pins.isValidJSON(localStorage.getItem('rdo.pinned-items'))) {
      JSON.parse(localStorage.getItem('rdo.pinned-items')).forEach(pinnedItem => {
        this.addPin(pinnedItem);
      });
    }
  }

  static addPin(data) {
    const marker = new Pin(data);
    this.pinsList.push(marker);

    const shadow = Settings.isShadowsEnabled ?
      `<img class="shadow" width="${35 * Settings.markerSize}" height="${16 * Settings.markerSize}" src="./assets/images/markers-shadow.png" alt="Shadow">` : '';
    const tempMarker = L.marker([marker.lat, marker.lng], {
      opacity: Settings.markerOpacity,
      icon: new L.DivIcon.DataMarkup({
        iconSize: [35 * Settings.markerSize, 45 * Settings.markerSize],
        iconAnchor: [17 * Settings.markerSize, 42 * Settings.markerSize],
        popupAnchor: [1 * Settings.markerSize, -29 * Settings.markerSize],
        html: `<div>
          <img class="icon" src="assets/images/icons/${marker.icon}.png" alt="Icon">
          <img class="background" src="assets/images/icons/marker_${MapBase.colorOverride || marker.color}.png" alt="Background">
          ${shadow}
        </div>`,
        marker: this.key,
        tippy: marker.title,
      }),
      id: marker.id,
      draggable: Settings.isPinsEditingEnabled,
    });
    tempMarker.bindPopup(marker.updateMarkerContent.bind(marker, () => this.onMap = false), { minWidth: 300, maxWidth: 400 });

    Pins.layer.addLayer(tempMarker);
    if (Settings.isMarkerClusterEnabled && !Settings.isPinsEditingEnabled)
      Layers.oms.addMarker(tempMarker);
    Pins.save();

    tempMarker.addEventListener('dragend', function () {
      Pins.pinsList.forEach(pin => {
        pin.save(pin.title, pin.description, pin.icon, pin.color);
      });
      Pins.save();
    }, { capture: false });
  }

  static addPinToCenter() {
    const center = MapBase.map.getCenter();
    Pins.addPin({ lat: center.lat, lng: center.lng });
  }

  static save() {
    localStorage.removeItem('pinned-items');
    localStorage.setItem('rdo.pinned-items', JSON.stringify(this.pinsList));
  }

  static importPins(text) {
    if (Pins.isValidJSON(text)) {
      console.log(text);
      localStorage.setItem('rdo.pinned-items', text);
      this.loadPins();
    } else {
      alert(Language.get('alerts.file_not_valid'));
      console.log(text);
    }
  }

  static exportPins() {
    const text = localStorage.getItem('rdo.pinned-items');
    const filename = 'pinned-items.txt';

    if (text === null) {
      alert(Language.get('alerts.nothing_to_export'));
      return;
    }

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
  }

  static isValidJSON(str) {
    try {
      if (str == null)
        return false;
      JSON.parse(str);
    } catch (e) {
      return false;
    }
    return true;
  }

  static set onMap(state) {
    if (state) {
      this.layer.addTo(MapBase.map);
      if (!MapBase.isPreviewMode)
        localStorage.setItem('rdo.pins-enabled', 'true');
      this.context.classList.remove('disabled');
    } else {
      this.layer.remove();
      if (!MapBase.isPreviewMode)
        localStorage.removeItem('rdo.pins-enabled');
      this.context.classList.add('disabled');
    }

    MapBase.updateTippy('pins');
  }

  static get onMap() {
    return !!localStorage.getItem('rdo.pins-enabled');
  }

  static removeAllPins() {
    Pins.pinsList = [];
    Object.keys(Pins.layer._layers).forEach(pin => {
      Pins.layer.removeLayer(pin);
    });
    Pins.save();
  }
}
