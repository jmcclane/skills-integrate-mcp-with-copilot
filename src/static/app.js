document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const signupContainer = document.getElementById("signup-container");
  const messageDiv = document.getElementById("message");
  const loginToggle = document.getElementById("login-toggle");
  const loginModal = document.getElementById("login-modal");
  const closeLoginModal = document.getElementById("close-login-modal");
  const loginForm = document.getElementById("login-form");
  const logoutButton = document.getElementById("logout-button");

  const ADMIN_CREDENTIALS = {
    username: "teacher",
    password: "admin123",
  };

  const state = {
    isTeacher: false,
    loginModalOpen: false,
  };

  async function checkSession() {
    try {
      const response = await fetch("/session");
      const data = await response.json();
      state.isTeacher = Boolean(data.is_teacher);
      updateTeacherUi();
    } catch (error) {
      console.error("Failed to fetch session state:", error);
      state.isTeacher = false;
      updateTeacherUi();
    }
  }

  function toggleLoginModal(forceOpen) {
    const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : !state.loginModalOpen;
    state.loginModalOpen = shouldOpen;
    loginModal.classList.toggle("hidden", !shouldOpen);
  }

  function updateTeacherUi() {
    const isTeacherLoggedIn = state.isTeacher;
    signupContainer.classList.toggle("hidden", !isTeacherLoggedIn);
    loginToggle.querySelector(".user-label").textContent = isTeacherLoggedIn ? "Teacher Mode" : "Teacher Login";
    logoutButton.classList.toggle("hidden", !isTeacherLoggedIn);

    const loginButtonText = isTeacherLoggedIn ? "Teacher Logged In" : "Teacher Login";
    loginToggle.setAttribute("aria-label", loginButtonText);
    loginToggle.title = isTeacherLoggedIn ? "Log out as teacher" : "Log in as teacher";
  }

  function showMessage(text, type = "success") {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function setTeacherLogin(isLoggedIn) {
    state.isTeacher = isLoggedIn;
    updateTeacherUi();
    if (!isLoggedIn) {
      signupForm.reset();
    }
  }

  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map((email) => {
                    const deleteButton = state.isTeacher
                      ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                      : "";
                    return `<li><span class="participant-email">${email}</span>${deleteButton}</li>`;
                  })
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    if (!state.isTeacher) {
      showMessage("Teacher login required to manage activity registrations.", "error");
      return;
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!state.isTeacher) {
      showMessage("Teacher login required to register students.", "error");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  loginToggle.addEventListener("click", () => {
    if (state.isTeacher) {
      setTeacherLogin(false);
      toggleLoginModal(false);
      return;
    }
    toggleLoginModal();
  });

  closeLoginModal.addEventListener("click", () => {
    toggleLoginModal(false);
  });

  loginModal.addEventListener("click", (event) => {
    if (event.target === loginModal) {
      toggleLoginModal(false);
    }
  });

  async function submitTeacherLogin(username, password) {
    try {
      const response = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "Invalid teacher username or password.");
      }

      setTeacherLogin(true);
      toggleLoginModal(false);
      loginForm.reset();
      showMessage("Teacher login successful.", "success");
      return true;
    } catch (error) {
      showMessage(error.message || "Invalid teacher username or password.", "error");
      loginForm.reset();
      return false;
    }
  }

  async function submitTeacherLogout() {
    try {
      await fetch("/logout", { method: "POST" });
    } catch (error) {
      console.error("Logout failed:", error);
    }

    setTeacherLogin(false);
    toggleLoginModal(false);
    showMessage("Logged out.", "info");
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    await submitTeacherLogin(username, password);
  });

  logoutButton.addEventListener("click", async () => {
    await submitTeacherLogout();
  });

  updateTeacherUi();
  checkSession();
  fetchActivities();
});
