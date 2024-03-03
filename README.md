# Virtual Steering Control with Hand Tracking 👐

This project leverages advanced hand tracking techniques to control virtual steering in racing games. Utilizing the power of OpenCV and the HandTrackingModule from cvzone, this Python script interprets hand gestures as steering commands, enabling an immersive gaming experience without the need for physical controllers.

## Introduction

The core idea of this project is to use real-time hand gesture recognition to simulate steering actions in racing games. By tracking the position and movement of the hands, the script translates these gestures into keyboard commands that control the in-game vehicle.

## Demo

Check out the demonstration of the project on YouTube to see how it works in action:          [Output Video](https://www.youtube.com/watch?v=is8RJPkHHAE).

## Getting Started

### Prerequisites

To run this project, you'll need the following installed on your system:

- Python 3.x
- OpenCV (`cv2`)
- PyAutoGUI
- PyDirectInput
- cvzone
- pynput
- keyboard

### Installation

1. Clone this repository to your local machine:
    ```bash
    git clone https://github.com/zamalali/Virtual-Steering.git
    ```
2. Navigate to the project directory:
    ```bash
    cd Virtual-Steering
    ```
3. Install the required Python packages. It's recommended to use a virtual environment:
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows use `venv\Scripts\activate`
    pip install -r requirements.txt
    ```

### Running the Script

1. Ensure your webcam is connected and properly configured.
2. Run the script:
    ```bash
    python Steering.py
    ```


## How It Works

- The script initializes the webcam and uses the `HandDetector` module from cvzone to detect and track the hands in real-time.
- Hand movements and gestures are interpreted as steering commands:
    - Bringing hands closer or further apart simulates steering left or right.
    - Specific gestures could be programmed to simulate acceleration or braking.
- The `pydirectinput` library is used to send keyboard commands to the racing game, based on the interpreted hand gestures.

## Customization

You can customize the sensitivity of the steering control, the specific gestures used, and the corresponding keyboard commands by modifying the script parameters.

## Safety and Precautions

- Ensure sufficient lighting for accurate hand tracking.
- Familiarize yourself with the game controls and ensure the virtual environment is safe for navigation using hand gestures.

## Contributions

Feel free to fork this repository and contribute by submitting a pull request. Whether it's adding new features, improving the hand tracking accuracy, or enhancing the documentation, all contributions are welcome!

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- The developers of OpenCV and cvzone for providing powerful tools for computer vision applications.
- The creators of PyAutoGUI and PyDirectInput for facilitating keyboard automation.
- The online community for their invaluable resources and support.

## Stay Connected

For more projects and updates, follow me on [GitHub](https://github.com/zamalali) and subscribe to my [YouTube Channel](https://www.youtube.com/@autopy9866).

