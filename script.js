const bookingForm = document.getElementById("booking-form");
const dateInput = document.getElementById("date");
const timeSelect = document.getElementById("time");
const submitButton = bookingForm.querySelector(".submit-button");

const defaultTimeText = "Select a date first";

function setBookingMessage(message, type = "info") {
    let messageElement = document.getElementById("booking-message");

    if (!messageElement) {
        messageElement = document.createElement("p");
        messageElement.id = "booking-message";
        bookingForm.appendChild(messageElement);
    }

    messageElement.textContent = message;
    messageElement.className = `booking-message ${type}`;
}

function setTimeOptions(times, placeholder = "Select a time") {
    timeSelect.innerHTML = "";

    const placeholderOption = document.createElement("option");
    placeholderOption.value = "";
    placeholderOption.textContent = placeholder;
    timeSelect.appendChild(placeholderOption);

    times.forEach((time) => {
        const option = document.createElement("option");
        option.value = time;
        option.textContent = time;
        timeSelect.appendChild(option);
    });
}

async function loadAvailableTimes() {
    const date = dateInput.value;

    if (!date) {
        setTimeOptions([], defaultTimeText);
        timeSelect.disabled = true;
        return;
    }

    timeSelect.disabled = true;
    setTimeOptions([], "Loading available times...");
    setBookingMessage("Checking availability...", "info");

    try {
        const response = await fetch(`/api/availability?date=${encodeURIComponent(date)}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Unable to load available times.");
        }

        if (data.availableTimes.length === 0) {
            setTimeOptions([], "No times available for this date");
            setBookingMessage("All appointment times are booked for this date. Please choose another day.", "error");
            return;
        }

        setTimeOptions(data.availableTimes);
        timeSelect.disabled = false;
        setBookingMessage("Choose one of the available times below.", "success");
    } catch (error) {
        setTimeOptions([], "Unable to load times");
        setBookingMessage(error.message, "error");
    }
}

const today = new Date().toISOString().split("T")[0];
dateInput.min = today;
setTimeOptions([], defaultTimeText);
timeSelect.disabled = true;

dateInput.addEventListener("change", loadAvailableTimes);

bookingForm.addEventListener("submit", function(event) {

    event.preventDefault();

    submitButton.disabled = true;
    submitButton.textContent = "Confirming...";
    setBookingMessage("Saving your appointment...", "info");

    const formData = new FormData(bookingForm);
    const appointment = Object.fromEntries(formData.entries());

    fetch("/api/appointments", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(appointment)
    })
        .then(async (response) => {
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Unable to save appointment.");
            }

            bookingForm.reset();
            setTimeOptions([], defaultTimeText);
            timeSelect.disabled = true;
            setBookingMessage(data.message, "success");
        })
        .catch(async (error) => {
            setBookingMessage(error.message, "error");
            await loadAvailableTimes();
        })
        .finally(() => {
            submitButton.disabled = false;
            submitButton.textContent = "Request Appointment";
        });

});
