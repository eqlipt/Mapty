'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;
  type;

  constructor(coords, distance, duration) {
    this.coords = coords;
    this.distance = distance;
    this.duration = duration;
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  _click() {
    this.clicks++;
  }

  _populateFromCopy(copy) {
    this.id = copy.id;
    this.date = new Date(copy.date);
    this.coords = copy.coords;
    this.distance = copy.distance;
    this.duration = copy.duration;
    this.type = copy.type;
    if (copy.cadence) this.cadence = copy.cadence;
    if (copy.elevationGain) this.elevationGain = copy.elevationGain;
  }
}

class Running extends Workout {
  type = 'running';
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    return (this.pace = this.duration / this.distance);
  }

  _update(distance, duration, cadence) {
    delete this.elevationGain;
    this.distance = distance;
    this.duration = duration;
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }
}

class Cycling extends Workout {
  type = 'cycling';
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    return (this.speed = this.distance / (this.duration / 60));
  }

  _update(distance, duration, elevationGain) {
    delete this.cadence;
    this.distance = distance;
    this.duration = duration;
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }
}

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const buttonReset = document.querySelector('.sidebar__action');

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #mapMarkers = [];
  #workouts = [];
  #currentWorkout = null;

  constructor() {
    // user's position
    this._getPosition();

    // get locally stored workouts
    this._getStorage();

    // event handlers
    form.addEventListener('submit', this._handleFormSubmit.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', e =>
      this._handleClickOnWorkoutList(e)
    );
    document.addEventListener('keyup', e => this._handleEscape(e));
    buttonReset.addEventListener('click', e => this._handleReset(e));
  }

  // Handlers
  _handleEscape(e) {
    if (e.key === 'Escape') {
      this._clearInputFields();
      this._hideForm();
      this.#currentWorkout = null;
    }
  }

  _handleClickOnWorkoutList(e) {
    if (e.target.closest('.workout') === null) return;
    this._moveToPopup(e);

    if (e.target.classList.contains('fa-trash-can')) {
      this._handleDelete(e);
      return;
    }

    if (e.target.classList.contains('fa-pen')) {
      this._handleEdit(e);
      return;
    }
  }

  _handleClickOnMap(mapE) {
    this.#mapEvent = mapE;
    this.#currentWorkout = null;
    this._clearInputFields();
    this._showForm();
  }

  _handleReset(e) {
    e.preventDefault();
    this._reset();
  }

  // Workout methods
  _getWorkoutFromArrayByEvent(e) {
    const workoutEl = this._getWorkoutElementByEvent(e);
    if (!workoutEl) return;
    return this._getWorkoutById(workoutEl.dataset.id);
  }

  _getWorkoutElementByEvent(e) {
    return e.target.closest('.workout');
  }

  _getWorkoutElementByWorkout(workout) {
    return document.querySelector('[data-id="' + workout.id + '"]');
  }

  _getWorkoutById(id) {
    return this.#workouts.find(wrkt => wrkt.id === id);
  }

  _getCurrentWorkoutIndex() {
    return this.#workouts.findIndex(el => el.id === this.#currentWorkout.id);
  }

  _handleEdit(e) {
    const workoutFromArray = this._getWorkoutFromArrayByEvent(e);
    if (!workoutFromArray) return;

    this.#currentWorkout = Object.create(Workout.prototype);
    this.#currentWorkout._populateFromCopy(workoutFromArray);
    this._fillForm(this.#currentWorkout);
    this._showForm();
  }

  _handleDelete(e) {
    // Identify clicked workout
    const workoutFromArray = this._getWorkoutFromArrayByEvent(e);
    if (!workoutFromArray) return;

    // Identify and delete map marker
    const markerToDelete = this.#mapMarkers.find(mrkr =>
      this._compareCoords(mrkr, workoutFromArray)
    );
    if (!markerToDelete) return;
    markerToDelete.remove();

    // Delete workout from DOM
    const workoutEl = this._getWorkoutElementByEvent(e);
    if (!workoutEl) return;
    workoutEl.remove();

    // Delete workout from array
    this.#workouts = this.#workouts.filter(
      wrkt => wrkt.id !== workoutFromArray.id
    );

    // Save array to localstorage
    this._setStorage();
  }

  // Map methods
  _getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(this._loadMap.bind(this), () => {
        alert('No location detected');
      });
    }
  }

  _getCoords() {
    if (this.#currentWorkout)
      return {
        lat: this.#currentWorkout.coords[0],
        lng: this.#currentWorkout.coords[1],
      };
    else if (this.#mapEvent) return this.#mapEvent.latlng;
    else return alert("Can't get coords");
  }

  _compareCoords(mapMarker, workout) {
    return (
      mapMarker._latlng.lat === workout.coords[0] &&
      mapMarker._latlng.lng === workout.coords[1]
    );
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    const coords = [latitude, longitude];
    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Render workouts from storage as markers on map
    this.#workouts.forEach(wrkt => this._renderWorkoutMarker(wrkt));

    // Handling clicks on map
    this.#map.on('click', this._handleClickOnMap.bind(this));
  }

  _moveToPopup(e) {
    const workoutFromArray = this._getWorkoutFromArrayByEvent(e);
    if (!workoutFromArray) return;
    this.#map.setView(workoutFromArray.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
    // workout._click();
  }

  _renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(workout.description)
      .openPopup();
    this.#mapMarkers.push(marker);
  }

  // Form methods
  _showForm() {
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _fillForm(workout) {
    this._clearInputFields();
    Array.from(inputType.options).find(
      opt => opt.value === workout.type
    ).selected = true;
    inputDistance.value = +workout.distance;
    inputDuration.value = +workout.duration;
    if (workout.cadence) {
      inputCadence.value = +workout.cadence;
      if (
        inputCadence
          .closest('.form__row')
          .classList.contains('form__row--hidden')
      ) {
        inputCadence
          .closest('.form__row')
          .classList.toggle('form__row--hidden');
        inputElevation
          .closest('.form__row')
          .classList.toggle('form__row--hidden');
      }
    }
    if (workout.elevationGain) {
      inputElevation.value = +workout.elevationGain;
      if (
        inputElevation
          .closest('.form__row')
          .classList.contains('form__row--hidden')
      ) {
        inputElevation
          .closest('.form__row')
          .classList.toggle('form__row--hidden');
        inputCadence
          .closest('.form__row')
          .classList.toggle('form__row--hidden');
      }
    }
  }

  _hideForm() {
    // Hide form
    form.classList.add('hidden');
    form.style.display = 'none';
    setTimeout(() => {
      (form.style.display = 'grid'), 500;
    });
  }

  _clearInputFields() {
    // prettier-ignore
    inputDistance.value = inputDuration.value = inputCadence.value = inputElevation.value = '';
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _handleFormSubmit(e) {
    e.preventDefault();
    function validateNumber(...inputs) {
      return inputs.every(num => Number.isFinite(num));
    }

    function validatePositive(...inputs) {
      return inputs.every(num => num > 0);
    }

    // Get coordinates
    const { lat, lng } = this._getCoords();

    // Get form data
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    let workout;

    // For running workout create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;
      // Validate input
      if (
        !validateNumber(distance, duration, cadence) ||
        !validatePositive(distance, duration, cadence)
      )
        return alert('Please enter positive numbers');
      if (this.#currentWorkout) {
        this.#currentWorkout.__proto__ = Running.prototype;
        this.#currentWorkout.type = 'running';
        this.#currentWorkout._update(distance, duration, cadence);
      } else workout = new Running([lat, lng], distance, duration, cadence);
    }
    // For cycling workout create cycling object
    if (type === 'cycling') {
      const elevationGain = +inputElevation.value;
      // Validate input
      if (
        !validateNumber(distance, duration, elevationGain) ||
        !validatePositive(distance, duration)
      )
        return alert('Please enter numbers');
      if (this.#currentWorkout) {
        this.#currentWorkout.__proto__ = Cycling.prototype;
        this.#currentWorkout.type = 'cycling';
        this.#currentWorkout._update(distance, duration, elevationGain);
      } else
        workout = new Cycling([lat, lng], distance, duration, elevationGain);
    }

    if (this.#currentWorkout) {
      // Replace subject workout in workouts array
      this.#workouts[this._getCurrentWorkoutIndex()] = this.#currentWorkout;

      // Replace rendered html for current workout
      this._updateCurrentWorkout(
        this._prepareWorkoutHTML(this.#currentWorkout)
      );
      // Re-apply event listener to workouts' container
      containerWorkouts.removeEventListener('click', e =>
        this._handleClickOnWorkoutList(e)
      );
      containerWorkouts.addEventListener('click', e =>
        this._handleClickOnWorkoutList(e)
      );
      //Re-render workout marker on map
      const markerToUpdate = this.#mapMarkers.find(mrkr =>
        this._compareCoords(mrkr, this.#currentWorkout)
      );
      markerToUpdate.remove();
      this._renderWorkoutMarker(this.#currentWorkout);

      // Reset current workout
      this.#currentWorkout = null;
    } else {
      // Add new object to workout array
      this.#workouts.push(workout);

      // Render workout on map as marker
      this._renderWorkoutMarker(workout);

      // Render workout in list
      this._renderWorkout(this._prepareWorkoutHTML(workout));
    }

    // Put workouts array to localstorage
    this._setStorage();

    // Hide and clear form
    this._clearInputFields();
    this._hideForm();
  }

  _prepareWorkoutHTML(workout) {
    let html = `
			<li class="workout workout--${workout.type}" data-id="${workout.id}">
				<h2 class="workout__title">${workout.description}</h2>
				<div class="workout__actions">
				<i class="workout__action fa-solid fa-pen fa-xl"></i>
					<i class="workout__action fa-solid fa-trash-can fa-xl"></i>
				</div>
				<div class="workout__details">
					<span class="workout__icon">${workout.type === 'running' ? '🏃‍♂️ ' : '🚴‍♀️ '}</span>
					<span class="workout__value">${workout.distance}</span>
					<span class="workout__unit">km</span>
				</div>
				<div class="workout__details">
					<span class="workout__icon">⏱</span>
					<span class="workout__value">${workout.duration}</span>
					<span class="workout__unit">min</span>
				</div>
		`;

    if (workout.type === 'running')
      html += `
				<div class="workout__details">
					<span class="workout__icon">⚡️</span>
					<span class="workout__value">${workout.pace.toFixed(1)}</span>
					<span class="workout__unit">min/km</span>
				</div>
				<div class="workout__details">
					<span class="workout__icon">🦶🏼</span>
					<span class="workout__value">${workout.cadence}</span>
					<span class="workout__unit">spm</span>
				</div>
			</li>
		`;

    if (workout.type === 'cycling') {
      html += `
				<div class="workout__details">
					<span class="workout__icon">⚡️</span>
					<span class="workout__value">${workout.speed.toFixed(1)}</span>
					<span class="workout__unit">km/h</span>
				</div>
				<div class="workout__details">
					<span class="workout__icon">⛰</span>
					<span class="workout__value">${workout.elevationGain}</span>
					<span class="workout__unit">m</span>
				</div>
			</li>
		`;
    }

    return html;
  }

  _renderWorkout(html) {
    form.insertAdjacentHTML('afterend', html);
  }

  _updateCurrentWorkout(html) {
    this._getWorkoutElementByWorkout(this.#currentWorkout).outerHTML = html;
  }

  // Storage methods
  _setStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getStorage() {
    const workouts = JSON.parse(localStorage.getItem('workouts'));
    if (!workouts) return;
    this.#workouts = workouts;
    workouts.forEach(wrkt => {
      this._renderWorkout(this._prepareWorkoutHTML(wrkt));
    });
  }

  _reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();
