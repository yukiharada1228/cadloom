import Cadloom

namespace Cadloom

/-- Unnormalized circular-cylinder implicit equation, q measured from an axis point. -/
def cylinderForm3 {K : Type*} [CommRing K] (dx dy dz x y z radiusSquared : K) : K :=
  (dy*z-dz*y)^2+(dz*x-dx*z)^2+(dx*y-dy*x)^2-
    radiusSquared*(dx^2+dy^2+dz^2)

/-- Lagrange identity relates the implemented cross-product form to axis distance. -/
theorem cylinder_projection_identity {K : Type*} [CommRing K] (dx dy dz x y z r : K) :
    cylinderForm3 dx dy dz x y z r =
      (dx^2+dy^2+dz^2)*(x^2+y^2+z^2)-(dx*x+dy*y+dz*z)^2-
      r*(dx^2+dy^2+dz^2) := by
  unfold cylinderForm3
  ring

/-- Moving the chosen axis origin along the same axis preserves the equation. -/
theorem cylinder_axis_shift {K : Type*} [CommRing K] (dx dy dz x y z r s : K) :
    cylinderForm3 dx dy dz (x+s*dx) (y+s*dy) (z+s*dz) r =
      cylinderForm3 dx dy dz x y z r := by
  unfold cylinderForm3
  ring

/-- Rescaling multiplies the equation by the square of the scale. -/
theorem cylinder_axis_scale {K : Type*} [CommRing K] (dx dy dz x y z r s : K) :
    cylinderForm3 (s*dx) (s*dy) (s*dz) x y z r =
      s^2*cylinderForm3 dx dy dz x y z r := by
  unfold cylinderForm3
  ring

/-- Coefficients of the implemented line/cylinder intersection polynomial. -/
theorem line_cylinder_polynomial {K : Type*} [CommRing K]
    (dx dy dz x y z vx vy vz r t : K) :
    cylinderForm3 dx dy dz (x+t*vx) (y+t*vy) (z+t*vz) r =
      ((dy*vz-dz*vy)^2+(dz*vx-dx*vz)^2+(dx*vy-dy*vx)^2)*t^2+
      2*((dy*z-dz*y)*(dy*vz-dz*vy)+(dz*x-dx*z)*(dz*vx-dx*vz)+
        (dx*y-dy*x)*(dx*vy-dy*vx))*t+
      cylinderForm3 dx dy dz x y z r := by
  unfold cylinderForm3
  ring

/-- The implemented radial normal is exactly perpendicular to the axis. -/
theorem cylinder_normal_perpendicular {K : Type*} [CommRing K] (dx dy dz x y z : K) :
    let D := dx^2+dy^2+dz^2
    let along := dx*x+dy*y+dz*z
    dx*(D*x-dx*along)+dy*(D*y-dy*along)+dz*(D*z-dz*along)=0 := by
  dsimp
  ring

/-- On a regular cylinder the normal has squared norm r*D². -/
theorem cylinder_normal_squared {K : Type*} [CommRing K] (dx dy dz x y z r : K)
    (h : cylinderForm3 dx dy dz x y z r = 0) :
    let D := dx^2+dy^2+dz^2
    let along := dx*x+dy*y+dz*z
    (D*x-dx*along)^2+(D*y-dy*along)^2+(D*z-dz*along)^2=r*D^2 := by
  unfold cylinderForm3 at h
  dsimp
  linear_combination (dx^2+dy^2+dz^2)*h

end Cadloom
