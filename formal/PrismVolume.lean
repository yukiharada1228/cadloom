import Cadloom

namespace Cadloom

structure SpacePoint where
  x : ℚ
  y : ℚ
  z : ℚ

def liftPoint (p : Point) (z : ℚ) : SpacePoint := ⟨p.x,p.y,z⟩
def volumeTerm (a b c : SpacePoint) : ℚ :=
  a.x*(b.y*c.z-b.z*c.y) + a.y*(b.z*c.x-b.x*c.z) + a.z*(b.x*c.y-b.y*c.x)

/-- Six times oriented volume of a triangular prism with outward face ordering. -/
def prismSixVolume (a b c : Point) (z h : ℚ) : ℚ :=
  volumeTerm (liftPoint a z) (liftPoint c z) (liftPoint b z) +
  volumeTerm (liftPoint a (z+h)) (liftPoint b (z+h)) (liftPoint c (z+h)) +
  volumeTerm (liftPoint a z) (liftPoint b z) (liftPoint b (z+h)) +
  volumeTerm (liftPoint a z) (liftPoint b (z+h)) (liftPoint a (z+h)) +
  volumeTerm (liftPoint b z) (liftPoint c z) (liftPoint c (z+h)) +
  volumeTerm (liftPoint b z) (liftPoint c (z+h)) (liftPoint b (z+h)) +
  volumeTerm (liftPoint c z) (liftPoint a z) (liftPoint a (z+h)) +
  volumeTerm (liftPoint c z) (liftPoint a (z+h)) (liftPoint c (z+h))

theorem prism_volume_eq_area_height (a b c : Point) (z h : ℚ) :
    prismSixVolume a b c z h = 3*h*cross (delta a b) (delta a c) := by
  dsimp [prismSixVolume, volumeTerm, liftPoint, cross, delta]
  ring

end Cadloom
