#pragma once

#include <QDebug>
#include <cmath>
#include <limits>

#include "engine/engine.h"
#include "util/fpclassify.h"

namespace mixxx {
namespace audio {
/// FrameDiff_t can be used to store the difference in position between
/// two frames and to store the length of a segment of track in terms of frames.
typedef double FrameDiff_t;

/// FramePos defines the position of a frame in a track
/// with respect to a fixed origin, i.e. start of the track.
class FramePos final {
  public:
    typedef double value_t;
    static constexpr value_t kStartValue = 0;
    static constexpr value_t kInvalidValue = std::numeric_limits<FramePos::value_t>::quiet_NaN();

    constexpr FramePos()
            : m_framePosition(kInvalidValue) {
    }

    constexpr explicit FramePos(value_t framePosition)
            : m_framePosition(framePosition) {
    }

    static constexpr FramePos fromEngineSamplePos(double engineSamplePos) {
        return FramePos(engineSamplePos / mixxx::kEngineChannelCount);
    }

    constexpr double toEngineSamplePos() const {
        return value() * mixxx::kEngineChannelCount;
    }

    bool isValid() const {
        return !util_isnan(m_framePosition) && !util_isinf(m_framePosition);
    }

    void setValue(value_t framePosition) {
        m_framePosition = framePosition;
    }

    constexpr value_t value() const {
        return m_framePosition;
    }

    bool isFractional() const {
        DEBUG_ASSERT(isValid());
        value_t integerPart;
        return std::modf(value(), &integerPart) != 0;
    }

    /// Return position rounded to the next lower full frame position, without
    /// the fractional part.
    [[nodiscard]] FramePos toLowerFrameBoundary() const {
        return FramePos(std::floor(value()));
    }

    FramePos& operator+=(FrameDiff_t increment) {
        m_framePosition += increment;
        return *this;
    }

    FramePos& operator-=(FrameDiff_t decrement) {
        m_framePosition -= decrement;
        return *this;
    }

    FramePos& operator*=(double multiple) {
        m_framePosition *= multiple;
        return *this;
    }

    FramePos& operator/=(double divisor) {
        m_framePosition /= divisor;
        return *this;
    }

  private:
    value_t m_framePosition;
};

/// FramePos can be added to a FrameDiff_t
inline FramePos operator+(FramePos framePos, FrameDiff_t frameDiff) {
    return FramePos(framePos.value() + frameDiff);
}

/// FramePos can be subtracted from a FrameDiff_t
inline FramePos operator-(FramePos framePos, FrameDiff_t frameDiff) {
    return FramePos(framePos.value() - frameDiff);
}

/// Two FramePos can be subtracted to get a FrameDiff_t
inline FrameDiff_t operator-(FramePos framePos1, FramePos framePos2) {
    return framePos1.value() - framePos2.value();
}

// Adding two FramePos is not allowed since every FramePos shares a common
// reference or origin i.e. the start of the track.

/// FramePos can be multiplied or divided by a double
inline FramePos operator*(FramePos framePos, double multiple) {
    return FramePos(framePos.value() * multiple);
}

inline FramePos operator/(FramePos framePos, double divisor) {
    return FramePos(framePos.value() / divisor);
}

inline bool operator<(FramePos frame1, FramePos frame2) {
    return frame1.value() < frame2.value();
}

inline bool operator<=(FramePos frame1, FramePos frame2) {
    return frame1.value() <= frame2.value();
}

inline bool operator>(FramePos frame1, FramePos frame2) {
    return frame1.value() > frame2.value();
}

inline bool operator>=(FramePos frame1, FramePos frame2) {
    return frame1.value() >= frame2.value();
}

inline bool operator==(FramePos frame1, FramePos frame2) {
    return frame1.value() == frame2.value();
}

inline bool operator!=(FramePos frame1, FramePos frame2) {
    return !(frame1.value() == frame2.value());
}

inline QDebug operator<<(QDebug dbg, FramePos arg) {
    dbg << arg.value();
    return dbg;
}

constexpr FramePos kInvalidFramePos = FramePos(FramePos::kInvalidValue);
constexpr FramePos kStartFramePos = FramePos(FramePos::kStartValue);
} // namespace audio
} // namespace mixxx

Q_DECLARE_TYPEINFO(mixxx::audio::FramePos, Q_MOVABLE_TYPE);
Q_DECLARE_METATYPE(mixxx::audio::FramePos);
