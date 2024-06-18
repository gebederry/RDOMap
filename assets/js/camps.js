class Camp {
  constructor(preliminary) {
    Object.assign(this, preliminary);

    this.element = $(`<div class="collectible-wrapper" data-help="item" data-type="${this.key}">`)
      .append($('<span class="collectible-text">')
      .toggleClass('disabled', !this.onMap)
      .on('click', () => {
        this.onMap = !this.onMap;
        setTimeout(() => CampCollection.layer.redraw(), 40);
      })
      .append($('<p class="collectible">').attr('data-text', `map.camps.${this.key}.name`)))
      .translate();

    this.element.appendTo(CampCollection.context);

    this.reinitMarker();

    if (this.onMap) {
      this.onMap = this.onMap;
    }
  }

  reinitMarker() {
    this.markers = [];
    const markerSize = Settings.markerSize;
    this.locations.forEach(_marker => {
      if (!CampCollection.isLarge && _marker.type === 'large') return;
      if (!CampCollection.isSmall && _marker.type === 'small') return;
      if (!CampCollection.isWilderness && _marker.type === 'wild') return;
      const tempMarker = L.marker([_marker.x, _marker.y], {
        opacity: Settings.markerOpacity,
        icon: L.divIcon({
          iconUrl: 'assets/images/markers/camp.png',
          iconSize: [35 * markerSize, 45 * markerSize],
          iconAnchor: [17 * markerSize, 42 * markerSize],
          popupAnchor: [0 * markerSize, -28 * markerSize],
          shadowUrl: 'assets/images/markers-shadow.png',
          shadowSize: [35 * markerSize, 16 * markerSize],
          shadowAnchor: [10 * markerSize, 10 * markerSize],
        }),
      });

      tempMarker.bindPopup(this.popupContent.bind(this, _marker), { minWidth: 300, maxWidth: 400 });
      this.markers.push(tempMarker);
    });
  }

  popupContent(_marker) {
    const title = `${Language.get(`map.camps.${this.key}.name`)} - ${Language.get(`map.camps.sizes.${_marker.type}`)}`;
    const description = Language.get('map.camps.desc');
    const popup = $(`
        <div>
          <h1>${title}</h1>
          <span class="marker-content-wrapper">
            <p>${description}</p>
          </span>
          <button class="btn btn-default full-popup-width" data-text="map.remove"></button>
          <small>Latitude: ${_marker.x} / Longitude: ${_marker.y}</small>
        </div>
      `)
      .translate()
      .find('small')
      .toggle(Settings.isDebugEnabled)
      .end()
      .find('button')
      .on('click', () => (this.onMap = false))
      .end()

    return popup[0];
  }

  set onMap(state) {
    if (!MapBase.isPreviewMode && !CampCollection.onMap) return false;
    if (state) {
      if (!CampCollection.enabledCategories.includes(this.key)) {
        CampCollection.markers = CampCollection.markers.concat(this.markers);
        CampCollection.enabledCategories.push(this.key);
      }
      CampCollection.layer.clearLayers();
      CampCollection.layer.addLayers(CampCollection.markers);
      if (!MapBase.isPreviewMode)
        localStorage.setItem(`rdo.${this.key}`, 'true');
      this.element.children('span').removeClass('disabled');
    } else {
      CampCollection.markers = CampCollection.markers.filter((el) => !this.markers.includes(el));
      CampCollection.enabledCategories = $.grep(CampCollection.enabledCategories, el => el !== this.key);

      CampCollection.layer.clearLayers();

      if (CampCollection.markers.length > 0)
        CampCollection.layer.addLayers(CampCollection.markers);

      if (!MapBase.isPreviewMode)
        localStorage.removeItem(`rdo.${this.key}`);
      this.element.children('span').addClass('disabled');
      MapBase.map.closePopup();
    }
  }

  get onMap() {
    return !!localStorage.getItem(`rdo.${this.key}`);
  }
}

class CampCollection {
  static init() {
    this.isLarge = true;
    this.isSmall = true;
    this.isWilderness = true;
    this.locations = [];
    this.quickParams = [];
    this.context = $('.menu-hidden[data-type=camps]');

    this.layer = L.canvasIconLayer({ zoomAnimation: true });
    this.enabledCategories = [];
    this.markers = [];
    this.element = $('.menu-option.clickable[data-type=camps]')
      .toggleClass('disabled', !CampCollection.onMap)
      .on('click', () => CampCollection.onMap = !CampCollection.onMap)
      .translate();

    CampCollection.layer.addTo(MapBase.map);

    return Loader.promises['camps'].consumeJson(data => {
      data.forEach(item => {
        this.locations.push(new Camp(item));
        this.quickParams.push(item.key);
      });
      console.info('%c[Camps] Loaded!', 'color: #bada55; background: #242424');
      setTimeout(() => CampCollection.layer.redraw(), 40);
      Menu.reorderMenu(this.context);
    });
  }

  static set onMap(state) {
    if (state) {
      this.layer.addTo(MapBase.map);
    } else {
      this.layer.remove();
    }
    this.element.toggleClass('disabled', !state);
    this.context.toggleClass('disabled', !state);

    if (!MapBase.isPreviewMode)
      localStorage.setItem('rdo.camps', JSON.stringify(state));

    CampCollection.locations.forEach(_camps => {
      if (_camps.onMap) _camps.onMap = state;
    });
  }

  static get onMap() {
    const value = JSON.parse(localStorage.getItem('rdo.camps'));
    return value || value == null;
  }

  static onLanguageChanged() {
    Menu.reorderMenu(this.context);
  }

  static toggleMarkersOnType() {
    this.markers = [];
    this.locations.forEach(camp => {
      camp.reinitMarker();
      if (camp.onMap)
        this.markers = this.markers.concat(camp.markers);
    });
    this.layer.clearLayers();
    if (this.markers.length > 0)
      this.layer.addLayers(this.markers);
  }
}
